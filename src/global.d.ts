declare global {
  interface Window {
    __CHANNEL_PULSE_CONFIG__?: {
      googleOAuthClientId?: string;
      appLabel?: string;
    };
  }
}

export {};
