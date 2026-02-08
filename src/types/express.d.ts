/**
 * Ensures TypeScript can resolve 'express' when @types/express isn't found
 * (e.g. under Yarn PnP or strict moduleResolution). Delete this file if
 * the project resolves express from node_modules/@types/express normally.
 */
declare module 'express' {
  import { Server } from 'http';
  export interface Request {
    body?: any;
    params?: any;
    query?: any;
    [key: string]: any;
  }
  export interface Response {
    status(code: number): Response;
    json(body: any): Response;
    redirect(status: number, url: string): Response;
    setHeader(name: string, value: string): Response;
    [key: string]: any;
  }
  export interface NextFunction {
    (err?: any): void;
  }
  export interface Application extends RequestHandler {
    use(...handlers: any[]): Application;
    get(path: any, ...handlers: any[]): Application;
    post(path: any, ...handlers: any[]): Application;
    put(path: any, ...handlers: any[]): Application;
    listen(port: number, callback?: () => void): Server;
    [key: string]: any;
  }
  export interface RequestHandler {
    (req: Request, res: Response, next?: NextFunction): any;
  }
  export interface Router extends Application {}
  export interface Express extends Application {}
  interface ExpressConstructor {
    (): Express;
    Router(): Router;
  }
  const express: ExpressConstructor;
  export function Router(): Router;
  export default express;
  export { express };
}
