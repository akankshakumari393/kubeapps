// Copyright 2018-2022 the Kubeapps contributors.
// SPDX-License-Identifier: Apache-2.0

import {
  AddPackageRepositoryRequest,
  DeletePackageRepositoryResponse,
  GetPackageRepositoryDetailResponse,
  GetPackageRepositorySummariesResponse,
  PackageRepositoryAuth_PackageRepositoryAuthType,
  PackageRepositoryReference,
  PackageRepositoryTlsConfig,
  SecretKeyReference,
  UpdatePackageRepositoryRequest,
} from "gen/kubeappsapis/core/packages/v1alpha1/repositories";
import { Plugin } from "gen/kubeappsapis/core/plugins/v1alpha1/plugins";
import { axiosWithAuth } from "./AxiosInstance";
import KubeappsGrpcClient from "./KubeappsGrpcClient";
import { IAppRepositoryFilter } from "./types";
import * as url from "./url";

export class PackageRepositoriesService {
  public static coreRepositoriesClient = () =>
    new KubeappsGrpcClient().getRepositoriesServiceClientImpl();

  public static async getPackageRepositorySummaries(
    cluster: string,
    namespace?: string,
  ): Promise<GetPackageRepositorySummariesResponse> {
    return await this.coreRepositoriesClient().GetPackageRepositorySummaries({
      context: {
        cluster,
        namespace,
      },
    });
  }

  public static async getPackageRepositoryDetail(
    packageRepoRef: PackageRepositoryReference,
  ): Promise<GetPackageRepositoryDetailResponse> {
    return await this.coreRepositoriesClient().GetPackageRepositoryDetail({ packageRepoRef });
  }

  public static async addPackageRepository(
    cluster: string,
    name: string,
    plugin: Plugin,
    namespace: string,
    repoURL: string,
    type: string,
    description: string,
    authHeader: string,
    authRegCreds: string,
    customCA: string,
    syncJobPodTemplate: any,
    registrySecrets: string[],
    ociRepositories: string[],
    skipTLS: boolean,
    passCredentials: boolean,
    namespaceScoped: boolean,
    authMethod: PackageRepositoryAuth_PackageRepositoryAuthType,
    filter?: IAppRepositoryFilter,
  ) {
    console.warn("UNUSED syncJobPodTemplate", JSON.stringify(syncJobPodTemplate));
    console.warn("UNUSED ociRepositories", JSON.stringify(ociRepositories));
    console.warn("UNUSED filter", JSON.stringify(filter));

    const addPackageRepositoryRequest = buildAddOrUpdateRequest(
      false,
      cluster,
      name,
      plugin,
      namespace,
      repoURL,
      type,
      description,
      authHeader,
      authRegCreds,
      customCA,
      // syncJobPodTemplate,
      registrySecrets,
      // ociRepositories[],
      skipTLS,
      passCredentials,
      authMethod,
      namespaceScoped,
      // filter?,
    );

    return await this.coreRepositoriesClient().AddPackageRepository(addPackageRepositoryRequest);
  }

  public static async updatePackageRepository(
    cluster: string,
    name: string,
    plugin: Plugin,
    namespace: string,
    repoURL: string,
    type: string,
    description: string,
    authHeader: string,
    authRegCreds: string,
    customCA: string,
    syncJobPodTemplate: any,
    registrySecrets: string[],
    ociRepositories: string[],
    skipTLS: boolean,
    passCredentials: boolean,
    authMethod: PackageRepositoryAuth_PackageRepositoryAuthType,
    filter?: IAppRepositoryFilter,
  ) {
    console.warn("UNUSED syncJobPodTemplate", JSON.stringify(syncJobPodTemplate));
    console.warn("UNUSED ociRepositories", JSON.stringify(ociRepositories));
    console.warn("UNUSED filter", JSON.stringify(filter));

    const updatePackageRepositoryRequest = buildAddOrUpdateRequest(
      true,
      cluster,
      name,
      plugin,
      namespace,
      repoURL,
      type,
      description,
      authHeader,
      authRegCreds,
      customCA,
      // syncJobPodTemplate,
      registrySecrets,
      // ociRepositories[],
      skipTLS,
      passCredentials,
      authMethod,
      // filter?,
    );

    return await this.coreRepositoriesClient().UpdatePackageRepository(
      updatePackageRepositoryRequest,
    );
  }

  public static async deletePackageRepository(
    packageRepoRef: PackageRepositoryReference,
  ): Promise<DeletePackageRepositoryResponse> {
    return await this.coreRepositoriesClient().DeletePackageRepository({
      packageRepoRef,
    });
  }

  // ............................... DEPRECATED ...............................

  public static async validate(
    cluster: string,
    namespace: string,
    repoURL: string,
    type: string,
    authHeader: string,
    authRegCreds: string,
    customCA: string,
    ociRepositories: string[],
    skipTLS: boolean,
    passCredentials: boolean,
  ) {
    const { data } = await axiosWithAuth.post<any>(
      url.backend.apprepositories.validate(cluster, namespace),
      {
        appRepository: {
          repoURL,
          type,
          authHeader,
          authRegCreds,
          customCA,
          ociRepositories,
          tlsInsecureSkipVerify: skipTLS,
          passCredentials: passCredentials,
        },
      },
    );
    return data;
  }

  public static async getSecretForRepo(cluster: string, namespace: string, name: string) {
    const {
      data: { secret },
    } = await axiosWithAuth.get<any>(url.backend.apprepositories.get(cluster, namespace, name));
    return secret;
  }

  public static async resync(cluster: string, namespace: string, name: string) {
    const { data } = await axiosWithAuth.post(
      url.backend.apprepositories.refresh(cluster, namespace, name),
      null,
    );
    return data;
  }
}

function buildAddOrUpdateRequest(
  isUpdate: boolean,
  cluster: string,
  name: string,
  plugin: Plugin,
  namespace: string,
  repoURL: string,
  type: string,
  description: string,
  authHeader: string,
  authRegCreds: string,
  customCA: string,
  registrySecrets: string[],
  skipTLS: boolean,
  passCredentials: boolean,
  authMethod: PackageRepositoryAuth_PackageRepositoryAuthType,
  namespaceScoped?: boolean,
) {
  const addPackageRepositoryRequest = {
    context: { cluster, namespace },
    name,
    description,
    namespaceScoped,
    type,
    url: repoURL,
    interval: 3600, // TODO(agamez): make it configurable
    auth: {
      header: authHeader,
      passCredentials,
      type: authMethod,
    },
    plugin,
    // customDetail: {
    //   typeUrl: "",
    //   value: undefined,
    // },
  } as AddPackageRepositoryRequest;

  // add optional fields if present in the request
  if (customCA) {
    addPackageRepositoryRequest.tlsConfig = {
      ...addPackageRepositoryRequest.tlsConfig,
      certAuthority: customCA,
    } as PackageRepositoryTlsConfig;
  }
  if (skipTLS) {
    addPackageRepositoryRequest.tlsConfig = {
      ...addPackageRepositoryRequest.tlsConfig,
      insecureSkipVerify: skipTLS,
    } as PackageRepositoryTlsConfig;
  }
  if (registrySecrets[0]) {
    addPackageRepositoryRequest.tlsConfig = {
      ...addPackageRepositoryRequest.tlsConfig,
      secretRef: {
        key: ".dockerconfigjson",
        name: registrySecrets[0],
      } as SecretKeyReference,
    } as PackageRepositoryTlsConfig;
  }
  if (authRegCreds) {
    addPackageRepositoryRequest.auth!.secretRef = {
      key: ".dockerconfigjson",
      name: authRegCreds,
    } as SecretKeyReference;
  }

  if (isUpdate) {
    const updatePackageRepositoryRequest: UpdatePackageRepositoryRequest = {
      description: addPackageRepositoryRequest.description,
      interval: addPackageRepositoryRequest.interval,
      url: addPackageRepositoryRequest.url,
      auth: addPackageRepositoryRequest.auth,
      customDetail: addPackageRepositoryRequest.customDetail,
      tlsConfig: addPackageRepositoryRequest.tlsConfig,
      packageRepoRef: {
        identifier: addPackageRepositoryRequest.name,
        context: addPackageRepositoryRequest.context,
        plugin: addPackageRepositoryRequest.plugin,
      },
    };
    return updatePackageRepositoryRequest;
  }
  return addPackageRepositoryRequest as UpdatePackageRepositoryRequest;

  // -- currently unsupported configuration --
  // tlsConfig.secretRef={ key: "", name: "" }, // reference a secret to pass the CA cert
  // auth.usernamePassword: { password: "", username: "" } // username and password for basic auth
  // auth.dockerCreds: { email: "", password: "", server: "", username: ""} // username and password for docker auth
  // auth.tlsCertKey: { cert: "", key: ""  // cert and key for tls auth
  return addPackageRepositoryRequest;
}

// function buildAddOrUpdateRequest(
//   cluster: string,
//   name: string,
//   plugin: Plugin,
//   namespace: string,
//   repoURL: string,
//   type: string,
//   description: string,
//   authHeader: string,
//   authRegCreds: string,
//   customCA: string,
//   registrySecrets: string[],
//   skipTLS: boolean,
//   passCredentials: boolean,
//   namespaceScoped: boolean,
//   authMethod: PackageRepositoryAuth_PackageRepositoryAuthType,
// ) {
//   const addPackageRepositoryRequest = {
//     context: { cluster, namespace },
//     name,
//     description,
//     namespaceScoped,
//     type,
//     url: repoURL,
//     interval: 3600, // TODO(agamez): make it configurable
//     auth: {
//       header: authHeader,
//       passCredentials,
//       type: authMethod,
//     },
//     plugin,
//     // customDetail: {
//     //   typeUrl: "",
//     //   value: undefined,
//     // },
//   } as AddPackageRepositoryRequest;

//   // add optional fields if present in the request
//   if (customCA) {
//     addPackageRepositoryRequest.tlsConfig = {
//       ...addPackageRepositoryRequest.tlsConfig,
//       certAuthority: customCA,
//     } as PackageRepositoryTlsConfig;
//   }
//   if (skipTLS) {
//     addPackageRepositoryRequest.tlsConfig = {
//       ...addPackageRepositoryRequest.tlsConfig,
//       insecureSkipVerify: skipTLS,
//     } as PackageRepositoryTlsConfig;
//   }
//   if (registrySecrets[0]) {
//     addPackageRepositoryRequest.tlsConfig = {
//       ...addPackageRepositoryRequest.tlsConfig,
//       secretRef: {
//         key: ".dockerconfigjson",
//         name: registrySecrets[0],
//       } as SecretKeyReference,
//     } as PackageRepositoryTlsConfig;
//   }
//   if (authRegCreds) {
//     addPackageRepositoryRequest.auth!.secretRef = {
//       key: ".dockerconfigjson",
//       name: authRegCreds,
//     } as SecretKeyReference;
//   }

//   // -- currently unsupported configuration --
//   // tlsConfig.secretRef={ key: "", name: "" }, // reference a secret to pass the CA cert
//   // auth.usernamePassword: { password: "", username: "" } // username and password for basic auth
//   // auth.dockerCreds: { email: "", password: "", server: "", username: ""} // username and password for docker auth
//   // auth.tlsCertKey: { cert: "", key: ""  // cert and key for tls auth
//   return addPackageRepositoryRequest;
// }
