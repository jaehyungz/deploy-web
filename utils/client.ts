import { useMemo } from "react";
import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  NormalizedCacheObject,
  split,
} from "@apollo/client";
import { IncomingHttpHeaders } from "http";
import { onError } from "@apollo/client/link/error";
import { createUploadLink } from "apollo-upload-client";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import fetch from "isomorphic-unfetch";

export const APOLLO_STATE_PROP_NAME = "__APOLLO_STATE__";

let apolloClient: ApolloClient<NormalizedCacheObject> | undefined;

// const SOCKET_URL =
//   process.env.NODE_ENV === "production"
//     ? process.env.SOCKET_API_URL
//     : typeof window === "undefined"
//     ? process.env.SOCKET_API_URL
//     : "/graphql";
const SOCKET_URL = "";
const BACKEND_URL = "";

// const BACKEND_URL =
//   process.env.NODE_ENV === "production"
//     ? process.env.BACKEND_API_URL
//     : typeof window === "undefined"
//     ? process.env.BACKEND_API_URL
//     : "/graphql";

function createApolloClient(headers: IncomingHttpHeaders | null = null) {
  const cookie = headers?.cookie ?? "";
  const enhancedFetch = async (url: RequestInfo, init: RequestInit) => {
    return await fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        Cookie: cookie,
      },
    });
  };

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
      for (const err of graphQLErrors) {
        if (err.extensions.status === 401) {
          // FIXME:  리플레시 토큰 발급 관련 코드 작성
          // apolloClient
          //   ?.query({ query: REFRESH_FROM_USER })
          //   .then((res) => {
          //     console.log(
          //       '리플레시 재발급',
          //       res.data.refreshFromUser.accessToken,
          //     );
          //   })
          //   .catch((error) => apolloClient?.clearStore());
        }
        if (err.message === "Unauthorized") {
          // message.error('장기간 사용하지 않아 자동 로그아웃 되었습니다.');
          // window.location.href = '/login';
          // return localStorage.setItem('accessToken', '');
        }
      }
    }
    if (networkError) {
      // message.error('네트워크 상태가 올바르지 않습니다.');
      return;
    }
  });

  const wsLink = () =>
    new GraphQLWsLink(
      createClient({
        url: SOCKET_URL,
      })
    );

  const uploadLink = createUploadLink({
    uri: BACKEND_URL,
    credentials: "include",
    fetch: enhancedFetch,
  });

  const splitLink =
    typeof window !== "undefined"
      ? split(
          ({ query }) => {
            const definition = getMainDefinition(query);
            return (
              definition.kind === "OperationDefinition" && definition.operation === "subscription"
            );
          },
          wsLink(),
          uploadLink
        )
      : uploadLink;

  const cleanTypeName = new ApolloLink((operation, forward) => {
    const definition = getMainDefinition(operation.query);
    const IS_QUERY = definition.kind === "OperationDefinition" && definition.operation === "query";

    if (IS_QUERY) {
      if (operation.variables) {
        const omitTypename = (key: string, value: any) => {
          return key === "__typename" ? undefined : value;
        };

        operation.variables = JSON.parse(JSON.stringify(operation.variables), omitTypename);
      }
    }

    return forward(operation).map((data) => data);
  });

  const authMiddleware = new ApolloLink((operation, forward) => {
    operation.setContext({
      headers: {
        cookie: cookie,
      },
    });
    return forward(operation);
  });

  return new ApolloClient({
    ssrMode: typeof window === "undefined",
    link: ApolloLink.from([cleanTypeName, authMiddleware, errorLink, splitLink]),
    cache: new InMemoryCache(),
    credentials: "same-origin",
  });
}

interface InitApollo {
  headers?: IncomingHttpHeaders | null;
  initialState?: NormalizedCacheObject | null;
}

export function initializeApollo({ headers = null, initialState = null }: InitApollo) {
  const _apolloClient = apolloClient ?? createApolloClient(headers);

  if (initialState) {
    _apolloClient.cache.restore(initialState);
  }

  if (typeof window === "undefined") return _apolloClient;
  if (!apolloClient) apolloClient = _apolloClient;

  return _apolloClient;
}

export function addApolloState(client: ApolloClient<NormalizedCacheObject>, pageProps: any) {
  if (pageProps?.props) {
    pageProps.props[APOLLO_STATE_PROP_NAME] = client.cache.extract();
  }

  return pageProps;
}

export function useApollo(pageProps: any) {
  const state = pageProps[APOLLO_STATE_PROP_NAME];
  const store = useMemo(() => initializeApollo({ initialState: state }), [state]);
  return store;
}
