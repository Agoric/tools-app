import { readFileSync } from 'fs';
import { createSign } from 'crypto';

type ServiceAccount = {
  auth_provider_x509_cert_url: string;
  auth_uri: string;
  client_email: string;
  client_id: string;
  client_x509_cert_url: string;
  project_id: string;
  private_key: string;
  private_key_id: string;
  token_uri: string;
  type: string;
  universe_domain: string;
};

const AUDIENCE = 'https://oauth2.googleapis.com/token';
const JWT_TOKEN_REQUEST_HEADER = { alg: 'RS256', typ: 'JWT' };
const SIGNING_ALGORITHM = 'RSA-SHA256';
const TOKEN_SCOPE = 'https://www.googleapis.com/auth/logging.read';

export let serviceAccount: ServiceAccount;

const base64urlEncode = (str: string) =>
  Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const createSignedJWT = (
  payload: {
    aud: string;
    exp: number;
    iat: number;
    iss: string;
    scope: string;
  },
  privateKey: ServiceAccount['private_key'],
) => {
  const encodedHeader = base64urlEncode(
    JSON.stringify(JWT_TOKEN_REQUEST_HEADER),
  );
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const toSign = `${encodedHeader}.${encodedPayload}`;
  const sign = createSign(SIGNING_ALGORITHM);
  sign.update(toSign);
  const signature = sign
    .sign(privateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${toSign}.${signature}`;
};

export const getAccessToken = async () => {
  if (!serviceAccount)
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS)
      throw Error('GOOGLE_APPLICATION_CREDENTIALS not present in environment');
    else
      serviceAccount = JSON.parse(
        readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'),
      );
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };

  const payload = {
    aud: AUDIENCE,
    exp: now + 3600,
    iat: now,
    iss: serviceAccount.client_email,
    scope: TOKEN_SCOPE,
  };

  const jwt = createSignedJWT(payload, serviceAccount.private_key);

  const params = new URLSearchParams();
  params.append('assertion', jwt);
  params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');

  const response = await fetch(AUDIENCE, {
    body: params.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  });

  if (!response.ok)
    throw Error(
      `Failed to obtain access token due to error: ${await response.text()}`,
    );

  const data = await response.json();

  return String(data.access_token);
};
