import type { youtube_v3 } from "googleapis";

export interface CreateLiveInput {
  title: string;
  description?: string;
  privacyStatus?:
    | "public"
    | "private"
    | "unlisted";
  scheduledStartTime?: Date;
}

export interface LiveSession {
  broadcastId: string;
  streamId: string;
  ingestionAddress: string;
  streamName: string;
  rtmpUrl: string;
  watchUrl: string;
}

export class YouTubeLiveService {
  constructor(
    private readonly youtube: youtube_v3.Youtube,
  ) {}

  async createLive(
    input: CreateLiveInput,
  ): Promise<LiveSession> {
    this.validateInput(input);

    const broadcastId =
      await this.createBroadcast(
        input,
      );

    try {
      const stream =
        await this.createStream(
          input,
        );

      await this.bindBroadcast(
        broadcastId,
        stream.streamId,
      );

      const rtmpUrl =
        `${stream.ingestionAddress}/${stream.streamName}`;

      return {
        broadcastId,
        streamId:
          stream.streamId,
        ingestionAddress:
          stream.ingestionAddress,
        streamName:
          stream.streamName,
        rtmpUrl,
        watchUrl:
          `https://www.youtube.com/watch?v=${broadcastId}`,
      };
    } catch (error) {
      throw new Error(
        `Failed to create YouTube live setup for broadcast ${broadcastId}: ${this.getErrorMessage(error)}`,
        {
          cause: error,
        },
      );
    }
  }

  private async createBroadcast(
    input: CreateLiveInput,
  ): Promise<string> {
    try {
      const scheduledStartTime =
        input.scheduledStartTime ??
        new Date();

      if (
        Number.isNaN(
          scheduledStartTime.getTime(),
        )
      ) {
        throw new Error(
          "scheduledStartTime is invalid",
        );
      }

      const response =
        await this.youtube.liveBroadcasts.insert(
          {
            part: [
              "id",
              "snippet",
              "status",
              "contentDetails",
            ],

            requestBody: {
              snippet: {
                title:
                  input.title,
                description:
                  input.description ??
                  "",
                scheduledStartTime:
                  scheduledStartTime.toISOString(),
              },

              status: {
                privacyStatus:
                  input.privacyStatus ??
                  "private",
              },

              contentDetails: {
                enableAutoStart:
                  true,
                enableAutoStop:
                  true,
                enableDvr:
                  true,
                recordFromStart:
                  true,
              },
            },
          },
        );

      const broadcastId =
        response.data.id;

      if (!broadcastId) {
        throw new Error(
          "YouTube did not return broadcast ID",
        );
      }

      console.log(
        `[YouTube] Broadcast created: ${broadcastId}`,
      );

      return broadcastId;
    } catch (error) {
      throw new Error(
        `Failed to create YouTube broadcast: ${this.getErrorMessage(error)}`,
        {
          cause: error,
        },
      );
    }
  }

  private async createStream(
    input: CreateLiveInput,
  ): Promise<{
    streamId: string;
    ingestionAddress: string;
    streamName: string;
  }> {
    try {
      const response =
        await this.youtube.liveStreams.insert(
          {
            part: [
              "id",
              "snippet",
              "cdn",
              "status",
            ],

            requestBody: {
              snippet: {
                title:
                  `${input.title} - Stream`,
              },

              cdn: {
                ingestionType:
                  "rtmp",
                resolution:
                  "1080p",
                frameRate:
                  "30fps",
              },
            },
          },
        );

      const streamId =
        response.data.id;

      if (!streamId) {
        throw new Error(
          "YouTube did not return stream ID",
        );
      }

      const ingestion =
        response.data.cdn
          ?.ingestionInfo;

      if (
        !ingestion
          ?.ingestionAddress
      ) {
        throw new Error(
          "YouTube did not return ingestionAddress",
        );
      }

      if (
        !ingestion.streamName
      ) {
        throw new Error(
          "YouTube did not return streamName",
        );
      }

      console.log(
        `[YouTube] Live stream created: ${streamId}`,
      );

      console.log(
        "[YouTube] RTMP ingestion configured",
      );

      return {
        streamId,
        ingestionAddress:
          ingestion.ingestionAddress,
        streamName:
          ingestion.streamName,
      };
    } catch (error) {
      throw new Error(
        `Failed to create YouTube live stream: ${this.getErrorMessage(error)}`,
        {
          cause: error,
        },
      );
    }
  }

  private async bindBroadcast(
    broadcastId: string,
    streamId: string,
  ): Promise<void> {
    if (!broadcastId?.trim()) {
      throw new Error(
        "broadcastId is required",
      );
    }

    if (!streamId?.trim()) {
      throw new Error(
        "streamId is required",
      );
    }

    try {
      await this.youtube.liveBroadcasts.bind(
        {
          id: broadcastId,
          streamId,
          part: [
            "id",
            "snippet",
            "status",
            "contentDetails",
          ],
        },
      );

      console.log(
        `[YouTube] Broadcast ${broadcastId} bound to stream ${streamId}`,
      );
    } catch (error) {
      throw new Error(
        `Failed to bind broadcast ${broadcastId} to stream ${streamId}: ${this.getErrorMessage(error)}`,
        {
          cause: error,
        },
      );
    }
  }

  async getStreamStatus(
    streamId: string,
  ) {
    if (!streamId?.trim()) {
      throw new Error(
        "streamId is required",
      );
    }

    try {
      const response =
        await this.youtube.liveStreams.list(
          {
            part: [
              "id",
              "snippet",
              "cdn",
              "status",
            ],
            id: [streamId],
          },
        );

      const stream =
        response.data.items?.[0];

      if (!stream) {
        throw new Error(
          `YouTube stream not found: ${streamId}`,
        );
      }

      return stream;
    } catch (error) {
      throw new Error(
        `Failed to get YouTube stream status for ${streamId}: ${this.getErrorMessage(error)}`,
        {
          cause: error,
        },
      );
    }
  }

  async getBroadcastStatus(
    broadcastId: string,
  ) {
    if (!broadcastId?.trim()) {
      throw new Error(
        "broadcastId is required",
      );
    }

    try {
      const response =
        await this.youtube.liveBroadcasts.list(
          {
            part: [
              "id",
              "snippet",
              "status",
              "contentDetails",
            ],
            id: [broadcastId],
          },
        );

      const broadcast =
        response.data.items?.[0];

      if (!broadcast) {
        throw new Error(
          `YouTube broadcast not found: ${broadcastId}`,
        );
      }

      return broadcast;
    } catch (error) {
      throw new Error(
        `Failed to get YouTube broadcast status for ${broadcastId}: ${this.getErrorMessage(error)}`,
        {
          cause: error,
        },
      );
    }
  }

  async logStreamStatus(
    streamId: string,
  ): Promise<void> {
    const stream =
      await this.getStreamStatus(
        streamId,
      );

    const streamStatus =
      stream.status
        ?.streamStatus ??
      "unknown";

    const health =
      stream.status
        ?.healthStatus;

    console.log(
      `[YouTube] Stream status: ${streamStatus}`,
    );

    console.log(
      `[YouTube] Health status: ${
        health?.status ??
        "unknown"
      }`,
    );

    const issues =
      health
        ?.configurationIssues ??
      [];

    if (issues.length === 0) {
      console.log(
        "[YouTube] No configuration issues reported",
      );
      return;
    }

    console.error(
      `[YouTube] ${issues.length} configuration issue(s):`,
    );

    for (const issue of issues) {
      console.error({
        type: issue.type,
        severity:
          issue.severity,
        description:
          issue.description,
      });
    }
  }

  async waitForStreamActive(
    streamId: string,
    options: {
      timeoutMs?: number;
      intervalMs?: number;
    } = {},
  ): Promise<void> {
    const timeoutMs =
      options.timeoutMs ??
      60_000;

    const intervalMs =
      options.intervalMs ??
      3_000;

    if (
      timeoutMs <= 0 ||
      intervalMs <= 0
    ) {
      throw new Error(
        "timeoutMs and intervalMs must be greater than zero",
      );
    }

    const start =
      Date.now();

    while (
      Date.now() - start <
      timeoutMs
    ) {
      const stream =
        await this.getStreamStatus(
          streamId,
        );

      const status =
        stream.status
          ?.streamStatus;

      if (
        status === "active"
      ) {
        console.log(
          "[YouTube] Stream is active",
        );
        return;
      }

      const issues =
        stream.status
          ?.healthStatus
          ?.configurationIssues ??
        [];

      if (issues.length > 0) {
        for (const issue of issues) {
          console.warn({
            type: issue.type,
            severity:
              issue.severity,
            description:
              issue.description,
          });
        }
      }

      console.log(
        `[YouTube] Waiting for active stream... current=${status ?? "unknown"}`,
      );

      await this.sleep(
        intervalMs,
      );
    }

    const stream =
      await this.getStreamStatus(
        streamId,
      );

    throw new Error(
      `YouTube stream did not become active within ${timeoutMs}ms. Current status: ${
        stream.status
          ?.streamStatus ??
        "unknown"
      }`,
    );
  }

  async waitForBroadcastLive(
    broadcastId: string,
    options: {
      timeoutMs?: number;
      intervalMs?: number;
    } = {},
  ): Promise<void> {
    if (!broadcastId?.trim()) {
      throw new Error(
        "broadcastId is required",
      );
    }

    const timeoutMs =
      options.timeoutMs ??
      60_000;

    const intervalMs =
      options.intervalMs ??
      3_000;

    if (
      timeoutMs <= 0 ||
      intervalMs <= 0
    ) {
      throw new Error(
        "timeoutMs and intervalMs must be greater than zero",
      );
    }

    const start =
      Date.now();

    while (
      Date.now() - start <
      timeoutMs
    ) {
      const broadcast =
        await this.getBroadcastStatus(
          broadcastId,
        );

      const status =
        broadcast.status
          ?.lifeCycleStatus;

      console.log(
        `[YouTube] Broadcast status: ${status ?? "unknown"}`,
      );

      switch (status) {
        case "live":
          console.log(
            "[YouTube] Broadcast is LIVE",
          );
          return;

        case "liveStarting":
          /*
           * IMPORTANT:
           *
           * Do NOT call transitionToLive().
           * YouTube is already starting it.
           */
          console.log(
            "[YouTube] Broadcast is starting...",
          );
          break;

        case "ready":
          console.log(
            "[YouTube] Broadcast is ready; waiting...",
          );
          break;

        case "created":
          console.log(
            "[YouTube] Broadcast is created; waiting...",
          );
          break;

        case "testing":
          console.log(
            "[YouTube] Broadcast is testing...",
          );
          break;

        case "complete":
          throw new Error(
            "YouTube broadcast is already complete",
          );

        case "revoked":
          throw new Error(
            "YouTube broadcast has been revoked",
          );

        default:
          console.log(
            `[YouTube] Waiting for broadcast to become live. Current=${status ?? "unknown"}`,
          );
      }

      await this.sleep(
        intervalMs,
      );
    }

    const broadcast =
      await this.getBroadcastStatus(
        broadcastId,
      );

    throw new Error(
      `YouTube broadcast did not become live within ${timeoutMs}ms. Current status: ${
        broadcast.status
          ?.lifeCycleStatus ??
        "unknown"
      }`,
    );
  }

  async transitionToComplete(
    broadcastId: string,
  ): Promise<void> {
    if (!broadcastId?.trim()) {
      throw new Error(
        "broadcastId is required",
      );
    }

    try {
      await this.youtube.liveBroadcasts.transition(
        {
          id: broadcastId,
          broadcastStatus:
            "complete",
          part: [
            "id",
            "status",
          ],
        },
      );

      console.log(
        `[YouTube] Broadcast ${broadcastId} completed`,
      );
    } catch (error) {
      throw new Error(
        `Failed to complete broadcast: ${this.getErrorMessage(error)}`,
        {
          cause: error,
        },
      );
    }
  }

  private validateInput(
    input: CreateLiveInput,
  ): void {
    if (!input) {
      throw new TypeError(
        "Live input is required",
      );
    }

    if (
      typeof input.title !==
        "string" ||
      !input.title.trim()
    ) {
      throw new TypeError(
        "Live title is required",
      );
    }

    if (
      input.title.length > 100
    ) {
      throw new TypeError(
        "Live title cannot exceed 100 characters",
      );
    }

    if (
      input.description !==
        undefined &&
      typeof input.description !==
        "string"
    ) {
      throw new TypeError(
        "Live description must be a string",
      );
    }

    if (
      input.privacyStatus !==
        undefined &&
      ![
        "public",
        "private",
        "unlisted",
      ].includes(
        input.privacyStatus,
      )
    ) {
      throw new TypeError(
        "Invalid privacyStatus",
      );
    }

    if (
      input.scheduledStartTime !==
        undefined
    ) {
      if (
        !(
          input.scheduledStartTime
            instanceof Date
        )
      ) {
        throw new TypeError(
          "scheduledStartTime must be a Date",
        );
      }

      if (
        Number.isNaN(
          input.scheduledStartTime.getTime(),
        )
      ) {
        throw new TypeError(
          "scheduledStartTime is invalid",
        );
      }
    }
  }

  private async sleep(
    milliseconds: number,
  ): Promise<void> {
    await new Promise<void>(
      (resolve) => {
        setTimeout(
          resolve,
          milliseconds,
        );
      },
    );
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}