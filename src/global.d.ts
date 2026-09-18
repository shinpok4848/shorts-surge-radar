declare global {
  interface Window {
    __CHANNEL_PULSE_CONFIG__?: {
      publicApiBaseUrl?: string;
      googleOAuthClientId?: string;
    };
  }
}

export {};
