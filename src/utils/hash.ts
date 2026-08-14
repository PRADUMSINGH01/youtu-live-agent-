import { createHmac } from "crypto";

const SALT_SEED = "ShipQuill@2026!";

export const generateHash = (text: string): Promise<string> => {
  return new Promise((resolve) => {
    const hmac = createHmac("sha256", SALT_SEED);
    hmac.update(text);
    resolve(hmac.digest("hex"));
  });
};

export const createAuthHash = (user: any) => {
  const saltText = `${user.uid}${user.email}${user.name}${user.avatar}`; 
  return generateHash(saltText);
};


const RTMP_URL = "rtmps://a.rtmp.youtube.com/live2";
export const createStreamKey = (user: any) => {
    const saltText = `${user.uid}${user.email}${user.name}${user.avatar}${RTMP_URL}`;
    return generateHash(saltText);
}