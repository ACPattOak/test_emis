/*
 * © 2021 Thoughtworks, Inc.
 */

import {
  TokenCredential,
  AccessToken,
  ClientCertificateCredential,
  ClientSecretCredential,
  WorkloadIdentityCredential,
} from '@azure/identity'
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import { configLoader } from '@cloud-carbon-footprint/common'

export default class AzureCredentialsProvider {
  static async create(): Promise<
    | ClientCertificateCredential
    | ClientSecretCredential
    | WorkloadIdentityCredential
    | TokenCredential
  > {
    const clientId = configLoader().AZURE.authentication.clientId
    let clientSecret: string | undefined = configLoader().AZURE.authentication.clientSecret;
    if (!clientSecret || clientSecret.trim() === '') {
      clientSecret = undefined; // Ensure clientSecret is undefined if not provided or empty
    }    const tenantId = configLoader().AZURE.authentication.tenantId
    const certificatePath = configLoader().AZURE.authentication.certificatePath

    // Assuming you add a new mode for using an existing access token
    const mode = configLoader().AZURE.authentication.mode;
    const accessToken = configLoader().AZURE.authentication.accessToken; // Ensure you add accessToken to your config

    switch (configLoader().AZURE.authentication.mode) {
      case 'GCP':
        const clientIdFromGoogle = await this.getGoogleSecret(clientId)
        const clientSecretFromGoogle = await this.getGoogleSecret(clientSecret)
        const tenantIdFromGoogle = await this.getGoogleSecret(tenantId)
        return new ClientSecretCredential(
          tenantIdFromGoogle,
          clientIdFromGoogle,
          clientSecretFromGoogle,
        )
      case 'WORKLOAD_IDENTITY':
        return new WorkloadIdentityCredential({
          tenantId: tenantId,
          clientId: clientId,
        })
      case 'CERTIFICATE':
        return new ClientCertificateCredential(
          tenantId,
          clientId,
          certificatePath,
        )
      case 'ACCESS_TOKEN': // New case for using an access token directly
        return {
          getToken: async (): Promise<AccessToken> => {
            // Here you return the existing access token
            // You would need to ensure that the expiration time is correctly handled
            return { token: accessToken, expiresOnTimestamp: Date.now() + 3600 * 1000 }; // Example expiration time
          }
        };
      default:
        if (clientSecret) {
          return new ClientSecretCredential(tenantId, clientId, clientSecret);
        } else {
          // Handle the case where clientSecret is not provided
          throw new Error("Client secret is required for the default authentication mode.");
        }    }
  }

  static async getGoogleSecret(secretName: string): Promise<string> {
    const client = new SecretManagerServiceClient()
    const name = `projects/${
      configLoader().GCP.BILLING_PROJECT_NAME
    }/secrets/${secretName}/versions/latest`

    const [version] = await client.accessSecretVersion({
      name: name,
    })
    return version.payload.data.toString()
  }
}
