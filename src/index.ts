import { createWriteStream } from 'node:fs';
import { Readable, promises } from 'node:stream';
import tempfile from 'tempfile';

type ErrorResponse = {
  errors: { items?: string[]; detail?: string };
  status_code?: number;
};

export class Koordinates {
  #host!: string;

  #apiKey!: string;

  constructor({ host, apiKey }: { host: string; apiKey: string }) {
    this.#host = host;
    this.#apiKey = apiKey;
  }

  static #API_PREFIX = '/services/api/v1.x';

  async #apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(
      `${this.#host}${Koordinates.#API_PREFIX}${path}`,
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key ${this.#apiKey}`,
          'User-Agent': 'https://npm.im/koordinates-api',
          ...options?.headers,
        },
      },
    );
    const json = (await response.json()) as T | ErrorResponse;

    if (typeof json === 'object' && json && 'errors' in json) {
      throw new Error(
        json.errors.detail ||
          json.errors.items?.join(', ') ||
          JSON.stringify(json.errors),
      );
    }

    return json;
  }

  generateExport(layerId: number) {
    return this.#apiRequest<Koordinates.Export>('/exports/', {
      method: 'POST',
      body: JSON.stringify({
        crs: 'EPSG:4326',
        items: [
          {
            item: `${this.#host}${Koordinates.#API_PREFIX}/layers/${layerId}/`,
          },
        ],
        formats: { vector: 'text/csv' },
      }),
    });
  }

  listExports() {
    return this.#apiRequest<Koordinates.ExportSummary[]>('/exports');
  }

  getExportDetails(exportId: number) {
    return this.#apiRequest<Koordinates.Export>(`/exports/${exportId}`);
  }

  /**
   * Saves the zip file to a temporary file,
   * returns the path to that file.
   */
  async downloadExport(downloadUrl: string) {
    const response = await fetch(downloadUrl, {
      headers: {
        Authorization: `key ${this.#apiKey}`,
        'User-Agent': 'https://npm.im/koordinates-api',
      },
    });

    const tempFile = tempfile('.zip');
    const fileStream = createWriteStream(tempFile, { flags: 'wx' });

    await promises.finished(Readable.fromWeb(response.body!).pipe(fileStream));

    return tempFile;
  }
}

export namespace Koordinates {
  export interface User {
    id: number;
    url: string;
    first_name: string;
    last_name: string;
    country: string;
    geotag: string;
    email: string;
    is_locked: boolean;
    is_site_admin: boolean;
    seat_type: string;
    date_joined: string;
  }

  export interface ExportSummary {
    created_at: null | string;
    created_via: 'web';
    download_url: string | null;
    id: number;
    name: string;
    state: 'complete' | 'processing' | 'error' | 'gone' | 'cancelled';
    url: string;
  }

  export interface Export extends ExportSummary {
    user: User;
    delivery: {
      method: 'download';
    };
    items: {
      item: string;
      color: string;
      title: string;
      format: string;
      short_format: string;
      data_type: string;
      data_type_label: string;
    }[];
    crs: {
      id: string;
      url: string;
      name: string;
      kind: string;
      unit_horizontal: string;
      unit_vertical: string;
      url_external: string;
      component_horizontal: null;
      component_vertical: null;
      srid: number;
    };
    extent: null;
    formats: {
      vector: 'text/csv';
    };
    options: unknown;
    size_estimate_unzipped: number;
    size_complete_zipped: number | null;
    size_complete_unzipped: number | null;
    is_cropped: boolean;
    invoice: null;
    from: {
      name: string;
      domain: string;
      owner: string;
      owner_short: string;
      copyright: string;
    };
    /** 0 to 1 */
    progress: number;
    downloaded_at: null | string;
    finished_at: null | string;
  }
}
