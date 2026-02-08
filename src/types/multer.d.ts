/**
 * Ensures TypeScript can resolve 'multer' when @types/multer isn't found
 * (e.g. under Yarn PnP). Delete this file if the project resolves multer from node_modules.
 */
declare module 'multer' {
  import { Request } from 'express';

  export interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }

  export interface StorageEngine {
    _handleFile(req: Request, file: File, callback: (error?: Error | null, info?: Partial<File>) => void): void;
    _removeFile(req: Request, file: File, callback: (error: Error | null) => void): void;
  }

  export interface Options {
    storage?: StorageEngine;
    limits?: { fileSize?: number };
    fileFilter?: (req: Request, file: File, cb: (error: Error | null, acceptFile?: boolean) => void) => void;
  }

  export interface Multer {
    single(fieldname: string): (req: Request, res: any, next: (err?: any) => void) => void;
    array(fieldname: string, maxCount?: number): (req: Request, res: any, next: (err?: any) => void) => void;
    fields(fields: { name: string; maxCount: number }[]): (req: Request, res: any, next: (err?: any) => void) => void;
    none(): (req: Request, res: any, next: (err?: any) => void) => void;
  }

  interface MulterConstructor {
    (options?: Options): Multer;
    memoryStorage(): StorageEngine;
  }

  const multer: MulterConstructor;
  export default multer;
}
