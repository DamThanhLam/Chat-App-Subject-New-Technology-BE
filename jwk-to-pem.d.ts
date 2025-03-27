declare module "jwk-to-pem" {
  function jwkToPem(jwk: Record<string, unknown>): string;
  export = jwkToPem;
}
