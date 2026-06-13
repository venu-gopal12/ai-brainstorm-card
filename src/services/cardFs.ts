import { CardFsFileType, type CardSdk } from 'dome-embedded-app-sdk';

interface CardFsListItem {
  name?: string;
}

interface CardFsError {
  code?: string;
  message?: string;
}

export function getCardFS(sdk: CardSdk) {
  return {
    list: (folder: string, shared = false) => {
      void shared;
      return new Promise<{ files: string[] }>((resolve, reject) => {
        sdk.cardFS.list(folder, {
          next: (res) => {
            const docs = res.documents || res.files || [];
            const files = docs
              .map((doc: CardFsListItem | string) => {
                const name = typeof doc === 'string' ? doc : doc.name;
                if (folder && folder !== '' && !name.startsWith(folder)) {
                  return folder + name;
                }
                return name;
              })
              .filter(Boolean);
            resolve({ files });
          },
          error: (err: CardFsError) => {
            if (err.code === 'NOT_FOUND' || (err.message || '').includes('404')) {
              resolve({ files: [] });
            } else {
              reject(err);
            }
          },
        });
      });
    },
    readFile: (name: string, shared = false) => {
      void shared;
      return new Promise<string>((resolve, reject) => {
        let resolved = false;
        sdk.cardFS.read(name, {
          next: (res) => {
            if (resolved) return;
            if (res.data && typeof res.data === 'object') {
              resolved = true;
              resolve(JSON.stringify(res.data));
              return;
            }
            if (typeof res.data === 'string' && res.data.length > 0) {
              resolved = true;
              resolve(res.data);
              return;
            }
            if (res.is_complete && !resolved) {
              reject(new Error('No content received'));
            }
          },
          error: (err) => {
            if (!resolved) reject(err);
          },
        });
      });
    },
    writeFile: (name: string, content: string, shared = false) => {
      void shared;
      return sdk.cardFS.write(name, content, CardFsFileType.TEXT);
    },
    deleteFile: (name: string, shared = false) => {
      void shared;
      return sdk.cardFS.delete(name);
    },
  };
}
