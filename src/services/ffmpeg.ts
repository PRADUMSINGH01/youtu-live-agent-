import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";

export interface FFmpegStreamerOptions {
  videoUrl: string;
  rtmpUrl: string;

  ffmpegPath?: string;
  loop?: boolean;
  startupTimeoutMs?: number;

  width?: number;
  height?: number;
  fps?: number;

  videoBitrate?: string;
  audioBitrate?: string;

  /**
   * Your Firebase source is already H.264 1080p30.
   * Stream copy avoids expensive CPU re-encoding.
   */
  copyVideo?: boolean;

  /**
   * Your source is already AAC.
   */
  copyAudio?: boolean;
}

export interface FFmpegCloseResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stoppedByUser: boolean;
}

export interface FFmpegProcessError
  extends Error {
  code?: string;
  signal?: NodeJS.Signals | null;
}

export class FFmpegStreamer extends EventEmitter {
  private readonly videoUrl: string;
  private readonly rtmpUrl: string;
  private readonly ffmpegPath: string;

  private readonly loop: boolean;
  private readonly startupTimeoutMs: number;

  private readonly width: number;
  private readonly height: number;
  private readonly fps: number;

  private readonly videoBitrate: string;
  private readonly audioBitrate: string;

  private readonly copyVideo: boolean;
  private readonly copyAudio: boolean;

  private process:
    | ChildProcessWithoutNullStreams
    | null = null;

  private stopping = false;

  constructor(
    options: FFmpegStreamerOptions,
  ) {
    super();

    this.videoUrl =
      this.validateVideoUrl(
        options.videoUrl,
      );

    this.rtmpUrl =
      this.validateRtmpUrl(
        options.rtmpUrl,
      );

    this.ffmpegPath =
      options.ffmpegPath?.trim() ||
      "ffmpeg";

    this.loop =
      options.loop ?? false;

    this.startupTimeoutMs =
      options.startupTimeoutMs ??
      30_000;

    this.width =
      options.width ?? 1920;

    this.height =
      options.height ?? 1080;

    this.fps =
      options.fps ?? 30;

    this.videoBitrate =
      options.videoBitrate ??
      "10000k";

    this.audioBitrate =
      options.audioBitrate ??
      "128k";

    this.copyVideo =
      options.copyVideo ?? true;

    this.copyAudio =
      options.copyAudio ?? true;

    this.validateEncoderOptions();
  }

  get running(): boolean {
    return this.process !== null;
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error(
        "FFmpeg is already running",
      );
    }

    this.stopping = false;

    const args =
      this.buildArguments();

    return new Promise<void>(
      (resolve, reject) => {
        let child:
          | ChildProcessWithoutNullStreams
          | undefined;

        let startupResolved = false;
        let startupRejected = false;

        let stderrBuffer = "";

        let startupTimer:
          | NodeJS.Timeout
          | undefined;

        const clearStartupTimer =
          () => {
            if (startupTimer) {
              clearTimeout(
                startupTimer,
              );
              startupTimer =
                undefined;
            }
          };

        const cleanupProcess =
          () => {
            if (
              child &&
              this.process === child
            ) {
              this.process = null;
            }
          };

        const resolveStartup =
          () => {
            if (
              startupResolved ||
              startupRejected
            ) {
              return;
            }

            startupResolved = true;
            clearStartupTimer();

            this.emit("started");
            resolve();
          };

        const rejectStartup =
          (error: Error) => {
            if (
              startupResolved ||
              startupRejected
            ) {
              return;
            }

            startupRejected = true;
            clearStartupTimer();

            reject(error);
          };

        startupTimer =
          setTimeout(() => {
            if (
              startupResolved ||
              startupRejected
            ) {
              return;
            }

            const error =
              new Error(
                `FFmpeg startup timeout after ${this.startupTimeoutMs}ms`,
              );

            this.emit(
              "error",
              error,
            );

            rejectStartup(
              error,
            );

            void this.stop().catch(
              (stopError) => {
                this.emit(
                  "error",
                  stopError,
                );
              },
            );
          }, this.startupTimeoutMs);

        try {
          child = spawn(
            this.ffmpegPath,
            args,
            {
              shell: false,
              stdio: [
                "pipe",
                "pipe",
                "pipe",
              ],
            },
          );
        } catch (error) {
          clearStartupTimer();

          const spawnError =
            new Error(
              `Failed to spawn FFmpeg: ${this.errorMessage(error)}`,
              {
                cause: error,
              },
            );

          this.emit(
            "error",
            spawnError,
          );

          rejectStartup(
            spawnError,
          );

          return;
        }

        this.process = child;

        child.once(
          "spawn",
          () => {
            this.emit("spawn", {
              pid: child?.pid,
              ffmpegPath:
                this.ffmpegPath,
            });
          },
        );

        child.stdout.setEncoding(
          "utf8",
        );

        child.stderr.setEncoding(
          "utf8",
        );

        child.stdout.on(
          "data",
          (data: string) => {
            this.emit(
              "stdout",
              data,
            );
          },
        );

        child.stderr.on(
          "data",
          (data: string) => {
            stderrBuffer += data;

            const lines =
              stderrBuffer.split(
                /\r?\n/,
              );

            stderrBuffer =
              lines.pop() ?? "";

            for (const rawLine of lines) {
              const message =
                rawLine.trim();

              if (!message) {
                continue;
              }

              this.emit(
                "log",
                message,
              );

              /*
               * FFmpeg output initialization.
               *
               * This only confirms that FFmpeg has
               * opened its output. YouTube status is
               * checked separately.
               */
              if (
                !startupResolved &&
                this.isOutputInitialized(
                  message,
                )
              ) {
                resolveStartup();
              }

              if (
                /connection refused/i.test(
                  message,
                ) ||
                /connection reset/i.test(
                  message,
                ) ||
                /input\/output error/i.test(
                  message,
                ) ||
                /failed to connect/i.test(
                  message,
                ) ||
                /broken pipe/i.test(
                  message,
                ) ||
                /end of file/i.test(
                  message,
                ) ||
                /server error/i.test(
                  message,
                )
              ) {
                this.emit(
                  "ffmpegWarning",
                  message,
                );
              }
            }
          },
        );

        child.once(
          "error",
          (error: Error) => {
            cleanupProcess();
            clearStartupTimer();

            const processError =
              new Error(
                `FFmpeg process error: ${this.errorMessage(error)}`,
                {
                  cause: error,
                },
              ) as FFmpegProcessError;

            processError.code =
              (
                error as NodeJS.ErrnoException
              ).code;

            this.emit(
              "error",
              processError,
            );

            rejectStartup(
              processError,
            );
          },
        );

        child.once(
          "close",
          (code, signal) => {
            cleanupProcess();
            clearStartupTimer();

            if (!startupResolved) {
              const details =
                stderrBuffer.trim();

              const message = [
                "FFmpeg exited before the stream started.",
                `code=${code ?? "null"}`,
                `signal=${signal ?? "null"}`,
                details
                  ? `details=${details}`
                  : undefined,
              ]
                .filter(Boolean)
                .join(" ");

              const error =
                new Error(
                  message,
                );

              this.emit(
                "error",
                error,
              );

              rejectStartup(
                error,
              );
            }

            const result: FFmpegCloseResult =
              {
                code,
                signal,
                stoppedByUser:
                  this.stopping,
              };

            this.emit(
              "closed",
              result,
            );
          },
        );
      },
    );
  }

  async stop(
    gracefulTimeoutMs = 5_000,
  ): Promise<void> {
    const child =
      this.process;

    if (!child) {
      return;
    }

    this.stopping = true;

    await new Promise<void>(
      (resolve, reject) => {
        let settled = false;

        const finish =
          () => {
            if (settled) {
              return;
            }

            settled = true;

            clearTimeout(
              forceKillTimer,
            );

            resolve();
          };

        const fail =
          (error: Error) => {
            if (settled) {
              return;
            }

            settled = true;

            clearTimeout(
              forceKillTimer,
            );

            reject(error);
          };

        const forceKillTimer =
          setTimeout(() => {
            if (
              child.exitCode !==
              null
            ) {
              finish();
              return;
            }

            try {
              child.kill(
                "SIGKILL",
              );
            } catch (error) {
              fail(
                new Error(
                  `Failed to force-kill FFmpeg: ${this.errorMessage(error)}`,
                  {
                    cause: error,
                  },
                ),
              );
            }
          }, gracefulTimeoutMs);

        child.once(
          "close",
          finish,
        );

        try {
          if (
            child.stdin.writable &&
            !child.stdin.destroyed
          ) {
            child.stdin.write(
              "q\n",
            );
            child.stdin.end();
          } else {
            child.kill(
              "SIGTERM",
            );
          }
        } catch (error) {
          if (
            child.exitCode !==
            null
          ) {
            finish();
            return;
          }

          fail(
            new Error(
              `Failed to stop FFmpeg: ${this.errorMessage(error)}`,
              {
                cause: error,
              },
            ),
          );
        }
      },
    );
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  private buildArguments(): string[] {
    const args: string[] = [
      "-hide_banner",
      "-loglevel",
      "info",
    ];

    if (this.loop) {
      args.push(
        "-stream_loop",
        "-1",
      );
    }

    if (/^https?:\/\//i.test(this.videoUrl)) {
      args.push(
        "-reconnect",
        "1",
        "-reconnect_at_eof",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        "5",
      );
    }

    args.push(
      "-re",

      "-i",
      this.videoUrl,

      /*
       * Video required.
       * Audio optional.
       */
      "-map",
      "0:v:0",

      "-map",
      "0:a:0?",
    );

    /*
     * --------------------------------------------------
     * VIDEO
     * --------------------------------------------------
     */

    if (this.copyVideo) {
      /*
       * Source:
       * H.264
       * 1920x1080
       * 30fps
       *
       * No re-encoding.
       */
      args.push(
        "-c:v",
        "copy",
      );
    } else {
      /*
       * Transcode fallback.
       */
      args.push(
        "-c:v",
        "libx264",

        "-preset",
        "veryfast",

        "-pix_fmt",
        "yuv420p",

        "-s",
        `${this.width}x${this.height}`,

        "-r",
        String(this.fps),

        "-b:v",
        this.videoBitrate,

        "-minrate",
        this.videoBitrate,

        "-maxrate",
        this.videoBitrate,

        "-bufsize",
        this.calculateBufferSize(),

        "-g",
        String(
          this.fps * 2,
        ),

        "-keyint_min",
        String(
          this.fps * 2,
        ),

        "-sc_threshold",
        "0",
      );
    }

    /*
     * --------------------------------------------------
     * AUDIO
     * --------------------------------------------------
     */

    if (this.copyAudio) {
      args.push(
        "-c:a",
        "copy",
      );
    } else {
      args.push(
        "-c:a",
        "aac",

        "-b:a",
        this.audioBitrate,

        "-ar",
        "44100",

        "-ac",
        "2",
      );
    }

    /*
     * --------------------------------------------------
     * RTMP OUTPUT
     * --------------------------------------------------
     */

    args.push(
      "-flvflags",
      "no_duration_filesize",
      "-f",
      "flv",
      this.rtmpUrl,
    );

    return args;
  }

  private calculateBufferSize(): string {
    const match =
      this.videoBitrate.match(
        /^(\d+(?:\.\d+)?)([kKmM])$/,
      );

    if (!match) {
      return "20000k";
    }

    const value =
      Number(match[1]);

    const unit =
      match[2].toLowerCase();

    const multiplier =
      unit === "m"
        ? 1000
        : 1;

    return `${
      value * multiplier * 2
    }k`;
  }

  private isOutputInitialized(
    message: string,
  ): boolean {
    return (
      /^Output #\d+/i.test(
        message,
      ) ||
      /^Stream mapping:/i.test(
        message,
      )
    );
  }

  private validateVideoUrl(
    value: string,
  ): string {
    if (
      typeof value !==
        "string" ||
      !value.trim()
    ) {
      throw new TypeError(
        "videoUrl must be a non-empty string",
      );
    }

    const trimmed = value.trim();

    if (fs.existsSync(trimmed)) {
      return path.resolve(trimmed);
    }

    let url: URL;

    try {
      url = new URL(trimmed);
    } catch (error) {
      if (
        trimmed.startsWith("/") ||
        /^[a-zA-Z]:[\\/]/.test(trimmed)
      ) {
        return trimmed;
      }

      throw new TypeError(
        `Invalid video URL or file path: ${this.errorMessage(error)}`,
        {
          cause: error,
        },
      );
    }

    if (
      ![
        "http:",
        "https:",
        "file:",
      ].includes(
        url.protocol,
      )
    ) {
      throw new TypeError(
        `Unsupported video URL protocol: ${url.protocol}`,
      );
    }

    if (url.protocol === "file:") {
      return url.pathname;
    }

    return url.toString();
  }

  private validateRtmpUrl(
    value: string,
  ): string {
    if (
      typeof value !==
        "string" ||
      !value.trim()
    ) {
      throw new TypeError(
        "rtmpUrl must be a non-empty string",
      );
    }

    let url: URL;

    try {
      url = new URL(value);
    } catch (error) {
      throw new TypeError(
        `Invalid RTMP URL: ${this.errorMessage(error)}`,
        {
          cause: error,
        },
      );
    }

    if (
      ![
        "rtmp:",
        "rtmps:",
      ].includes(
        url.protocol,
      )
    ) {
      throw new TypeError(
        `Unsupported RTMP URL protocol: ${url.protocol}`,
      );
    }

    return url.toString();
  }

  private validateEncoderOptions(): void {
    if (
      !Number.isInteger(
        this.width,
      ) ||
      this.width <= 0
    ) {
      throw new TypeError(
        "width must be a positive integer",
      );
    }

    if (
      !Number.isInteger(
        this.height,
      ) ||
      this.height <= 0
    ) {
      throw new TypeError(
        "height must be a positive integer",
      );
    }

    if (
      !Number.isInteger(
        this.fps,
      ) ||
      this.fps <= 0
    ) {
      throw new TypeError(
        "fps must be a positive integer",
      );
    }

    if (
      !Number.isInteger(
        this.startupTimeoutMs,
      ) ||
      this.startupTimeoutMs <= 0
    ) {
      throw new TypeError(
        "startupTimeoutMs must be a positive integer",
      );
    }
  }

  private errorMessage(
    error: unknown,
  ): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}