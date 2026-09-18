declare global {
  interface Window {
    __CHANNEL_PULSE_CONFIG__?: {
      googleOAuthClientId?: string;
      targetChannelHandle?: string;
      targetChannelId?: string;
    };
  }
}

export {};
