/**
 * Ensures TypeScript can resolve 'express' when @types/express isn't found
 * (e.g. under Yarn PnP). Delete this file if the project resolves express from node_modules.
 */
declare module 'express' {
  import { Server } from 'http';
  import { IncomingMessage, ServerResponse } from 'http';

  export interface Request {
    body?: any;
    params?: any;
    query?: any;
    protocol?: string;
    secure?: boolean;
    get(name: string): string | undefined;
    [key: string]: any;
  }

  export interface Response<T = any> {
    status(code: number): Response<T>;
    json(body: any): Response<T>;
    send(body: any): Response<T>;
    redirect(status: number, url: string): Response<T>;
    setHeader(name: string, value: string | number): Response<T>;
    [key: string]: any;
  }

  export interface NextFunction {
    (err?: any): void;
  }

  export type RequestHandler = (req: Request, res: Response, next?: NextFunction) => any;

  export interface Application {
    (req: IncomingMessage, res: ServerResponse): void;
    use(...handlers: any[]): Application;
    get(path: any, ...handlers: any[]): Application;
    post(path: any, ...handlers: any[]): Application;
    put(path: any, ...handlers: any[]): Application;
    options(path: any, ...handlers: any[]): Application;
    listen(port: number, callback?: () => void): Server;
    [key: string]: any;
  }

  export interface Router extends Application {}

  export interface Express extends Application {}

  interface ExpressConstructor {
    (): Express;
    Router(): Router;
    json(): any;
    urlencoded(options?: { extended?: boolean }): any;
  }

  const express: ExpressConstructor;
  export function Router(): Router;
  export default express;
  export { express };
}
