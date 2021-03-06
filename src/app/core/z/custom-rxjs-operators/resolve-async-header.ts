import { Observable, of } from 'rxjs';
import { WithHeaderOfType, WithHeaderIdOfType } from './filters';
import { grabHeader } from './maps';
import { mergeMap, withLatestFrom, take, map, catchError, takeUntil } from 'rxjs/operators';
import { AsyncAction, Headers } from '../core/models';
import { Action } from '../core/types';
import { ASYNC_HEADER } from '../core/symbols';

export type _ResolverWithRequestAndSource<Request, Response, Source> = (request: Request, source: Source) => Observable<Response>;
export type _ResolverWithRequest<Request, Response, _ extends 'foo' = 'foo'> = (request: Request, _?: _) => Observable<Response>;
export type _ResolverWithSource<Response, Source, _ extends 'bar' = 'bar'> = (source: Source, _?: _) => Observable<Response>;
export type _Resolver<Response> = () => Observable<Response>;

export type Resolver<Request, Response, Source = void> = Request extends void
    ? (
        Source extends void
            ? _Resolver<Response>
            : _ResolverWithSource<Response, Source>
    ) 
    : (
        Source extends void
            ? _ResolverWithRequest<Request, Response>
            : _ResolverWithRequestAndSource<Request, Response, Source>
    );

export function switchResolver<Request, Response, Source = void>(
    resolver: Resolver<Request, Response, Source>,
    payload: Request,
    source?: Source,
) {
    if (payload !== undefined) {
        if (source !== undefined) {
            const _resolver = resolver as _ResolverWithRequestAndSource<Request, Response, Source>;
            return _resolver(payload, source);
        } else {
            const _resolver = resolver as _ResolverWithRequest<Request, Response>;
            return _resolver(payload);
        }
    } else {
        if (source !== undefined) {
            const _resolver = resolver as _ResolverWithSource<Response, Source>;
            return _resolver(source);
        } else {
            const _resolver = resolver as _Resolver<Response>;
            return _resolver();
        }
    }
}

export function basicAsyncHeaderResolver<Request, Response, Source = void>(
    action: AsyncAction<Request, Response>,
    resolver: Resolver<Request, Response, Source>,
    withLatestFrom$?: Observable<Source>,
    attachOnResponse: (action: Action<Request>, response?: Response) => Headers = () => [],
    attachOnError: (action: Action<Request>, error?: Error) => Headers = () => [],
    asyncHeaderType: string = ASYNC_HEADER,
) {
    const asyncOfType = WithHeaderOfType(asyncHeaderType);
    const requestType = action.Request.type;
    const cancelType = action.Cancel.type;
    return (actions$: Observable<Action<any>>) => actions$.pipe(
        asyncOfType(requestType),
        grabHeader(asyncHeaderType),
        withLatestFrom(withLatestFrom$ || of(undefined)),
        mergeMap(([{ action: request, header: async }, source]) => {
            const otherHeaders = request.headers.filter(h => h.followAsync);
            const resolved$ = switchResolver<Request, Response, Source>(
                resolver,
                request['payload'],
                withLatestFrom$ ? source : undefined
            );
            const thisAsyncOfType = WithHeaderIdOfType(async.id);
            const cancel$ = actions$.pipe(thisAsyncOfType(cancelType));
            const onResolve = (response: Response) => new action.Response(
                response,
                request as Action<Request>,
                attachOnResponse(request as Action<Request>).concat(...otherHeaders)
            );
            const onError = (error: Error) => of(new action.Error(
                error,
                request as Action<Request>,
                attachOnError(request as Action<Request>).concat(...otherHeaders)
            ));
            return resolved$.pipe(take(1), map(onResolve), catchError(onError), takeUntil(cancel$));
        })
    );
}
