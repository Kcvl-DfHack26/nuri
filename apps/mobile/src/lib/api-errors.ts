export function requireSignedInMutationOk(
  response: Pick<Response, 'ok' | 'status'>,
  errorMessage: string,
) {
  if (!response.ok) {
    throw new Error(response.status === 401 ? 'ログインし直してください。' : errorMessage);
  }
}
