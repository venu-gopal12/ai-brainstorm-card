import { useEffect, useState } from 'react';
import {
  CardSdk,
  getKeyFromBlob,
  type CardEventHandler,
  type CardInitData,
  type CardInitErrorPayload,
  type CardKeyBlobV1,
  type CardUser,
} from 'dome-embedded-app-sdk';

function readCardBlob(): { blob: CardKeyBlobV1 | null; error: CardInitErrorPayload | null } {
  const decBlob = import.meta.env.VITE_CARD_DEC_BLOB;
  if (!decBlob) {
    return {
      blob: null,
      error: {
        message: 'Missing VITE_CARD_DEC_BLOB env variable',
        error_code: 'MISSING_CARD_DEC_BLOB',
      },
    };
  }

  try {
    return { blob: JSON.parse(decBlob) as CardKeyBlobV1, error: null };
  } catch {
    return {
      blob: null,
      error: {
        message: 'Invalid VITE_CARD_DEC_BLOB JSON',
        error_code: 'INVALID_CARD_DEC_BLOB',
      },
    };
  }
}

export function useCardSdk() {
  const [initialCardBlob] = useState(readCardBlob);
  const [user, setUser] = useState<CardUser | null>(null);
  const [sdk, setSdk] = useState<CardSdk | null>(null);
  const [initError, setInitError] = useState<CardInitErrorPayload | null>(initialCardBlob.error);

  useEffect(() => {
    if (!initialCardBlob.blob) return;

    const eventHandler: CardEventHandler = {
      onInit: (data: CardInitData) => {
        const { user, ui } = data;
        if (user) setUser(user);
        if (ui?.theme) {
          document.documentElement.setAttribute('data-theme', ui.theme);
          document.body.style.background = ui.theme === 'light' ? '#ffffff' : '#0f0f0f';
          document.body.style.color = ui.theme === 'light' ? '#0f0f0f' : '#f0f0f0';
        }
      },
      onInitError: (data) => setInitError(data),
      onError: (data: { message: string; error_code: string | number }) => {
        console.error('Error', data.message);
      },
    };

    CardSdk.init(getKeyFromBlob(initialCardBlob.blob), eventHandler)
      .then((initializedSdk) => setSdk(initializedSdk))
      .catch((err) => console.error('Init failed', err));
  }, [initialCardBlob.blob]);

  return { user, sdk, initError };
}
