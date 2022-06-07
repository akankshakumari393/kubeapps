// Copyright 2019-2022 the Kubeapps contributors.
// SPDX-License-Identifier: Apache-2.0

import {
  CdsAccordion,
  CdsAccordionContent,
  CdsAccordionHeader,
  CdsAccordionPanel,
} from "@cds/react/accordion";
import { CdsButton } from "@cds/react/button";
import { CdsCheckbox } from "@cds/react/checkbox";
import { CdsControlMessage, CdsFormGroup } from "@cds/react/forms";
import { CdsInput } from "@cds/react/input";
import { CdsRadio, CdsRadioGroup } from "@cds/react/radio";
import { CdsTextarea } from "@cds/react/textarea";
import actions from "actions";
import Alert from "components/js/Alert";
import {
  DockerCredentials,
  PackageRepositoryAuth_PackageRepositoryAuthType,
  PackageRepositoryReference,
  UsernamePassword,
} from "gen/kubeappsapis/core/packages/v1alpha1/repositories";
import { Plugin } from "gen/kubeappsapis/core/plugins/v1alpha1/plugins";
import { RepositoryCustomDetails } from "gen/kubeappsapis/plugins/helm/packages/v1alpha1/helm";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Action } from "redux";
import { ThunkDispatch } from "redux-thunk";
import { toFilterRule, toParams } from "shared/jq";
import { IPkgRepoFormData, IPkgRepositoryFilter, IStoreState } from "shared/types";
import { getPluginByName, getPluginPackageName, PluginNames } from "shared/utils";
import "./AppRepoForm.css";
interface IAppRepoFormProps {
  onSubmit: (data: IPkgRepoFormData) => Promise<boolean>;
  onAfterInstall?: () => void;
  namespace: string;
  kubeappsNamespace: string;
  packageRepoRef?: PackageRepositoryReference;
}

//  enum for the type of package repository storage
export enum RepositoryStorageTypes {
  PACKAGE_REPOSITORY_STORAGE_HELM = "helm",
  PACKAGE_REPOSITORY_STORAGE_OCI = "oci",
  PACKAGE_REPOSITORY_STORAGE_CARVEL_INLINE = "inline",
  PACKAGE_REPOSITORY_STORAGE_CARVEL_IMAGE = "image",
  PACKAGE_REPOSITORY_STORAGE_CARVEL_IMGPKGBUNDLE = "imgpkgBundle",
  PACKAGE_REPOSITORY_STORAGE_CARVEL_HTTP = "http",
  PACKAGE_REPOSITORY_STORAGE_CARVEL_GIT = "git",
}

export function AppRepoForm(props: IAppRepoFormProps) {
  const { onSubmit, onAfterInstall, namespace, kubeappsNamespace, packageRepoRef } = props;
  const isInstallingRef = useRef(false);
  const dispatch: ThunkDispatch<IStoreState, null, Action> = useDispatch();

  const {
    repos: {
      repo,
      errors: { create: createError, update: updateError, validate: validationError },
      validating,
    },
    clusters: { currentCluster },
  } = useSelector((state: IStoreState) => state);

  // initial state (collapsed or not) of each accordion tab
  const [accordion, setAccordion] = useState([true, false, false, false]);

  const [authCustomHeader, setAuthCustomHeader] = useState("");
  const [authMethod, setAuthMethod] = useState(
    PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_UNSPECIFIED,
  );
  const [basicPassword, setBasicPassword] = useState("");
  const [basicUser, setBasicUser] = useState("");
  const [bearerToken, setBearerToken] = useState("");
  const [customCA, setCustomCA] = useState("");
  const [description, setDescription] = useState("");
  const [filterExclude, setFilterExclude] = useState(false);
  const [filterNames, setFilterNames] = useState("");
  const [filterRegex, setFilterRegex] = useState(false);
  const [interval, setInterval] = useState(3600);
  const [name, setName] = useState("");
  const [ociRepositories, setOCIRepositories] = useState("");
  const [passCredentials, setPassCredentials] = useState(!!repo?.auth?.passCredentials);
  const [performValidation, setPerformValidation] = useState(true);
  const [plugin, setPlugin] = useState({} as Plugin);
  const [secretEmail, setSecretEmail] = useState("");
  const [secretPassword, setSecretPassword] = useState("");
  const [secretServer, setSecretServer] = useState("");
  const [secretUser, setSecretUser] = useState("");
  const [skipTLS, setSkipTLS] = useState(!!repo?.tlsConfig?.insecureSkipVerify);
  const [type, setType] = useState("");
  const [url, setURL] = useState("");

  const toggleAccordion = (section: number) => {
    const items = [...accordion];
    items[section] = !items[section];
    setAccordion(items);
  };

  useEffect(() => {
    if (packageRepoRef) {
      dispatch(actions.repos.fetchRepo(packageRepoRef));
    }
  }, [dispatch, packageRepoRef]);

  useEffect(() => {
    if (repo) {
      // populate state properties from the incoming repo
      setName(repo.name);
      setURL(repo.url);
      setType(repo.type);
      setPlugin(repo.packageRepoRef?.plugin || ({ name: "", version: "" } as Plugin));
      setDescription(repo.description);
      setSkipTLS(!!repo.tlsConfig?.insecureSkipVerify);
      setPassCredentials(!!repo.auth?.passCredentials);
      setInterval(repo.interval);
      setCustomCA(repo.tlsConfig?.certAuthority || "");
      setAuthCustomHeader(repo.auth?.header || "");
      setBearerToken(repo.auth?.header || "");
      setBasicPassword(repo.auth?.usernamePassword?.password || "");
      setBasicUser(repo.auth?.usernamePassword?.username || "");
      setSecretEmail(repo.auth?.dockerCreds?.email || "");
      setSecretPassword(repo.auth?.dockerCreds?.password || "");
      setSecretServer(repo.auth?.dockerCreds?.server || "");
      setSecretUser(repo.auth?.dockerCreds?.username || "");

      const repositoryCustomDetails = repo.customDetail as Partial<RepositoryCustomDetails>;
      setOCIRepositories(repositoryCustomDetails?.ociRepositories?.join(", ") || "");
      setPerformValidation(repositoryCustomDetails?.performValidation || false);
      if (repositoryCustomDetails?.filterRule?.jq) {
        const { names, regex, exclude } = toParams(repositoryCustomDetails.filterRule!);
        setFilterRegex(regex);
        setFilterExclude(exclude);
        setFilterNames(names);
      }
    }
  }, [repo, namespace, currentCluster, dispatch]);

  const handleInstallClick = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    install();
  };

  const install = async () => {
    if (isInstallingRef.current) {
      // Another installation is ongoing
      return;
    }
    isInstallingRef.current = true;

    // send the proper header depending on the auth method
    let finalHeader = "";
    switch (authMethod) {
      case PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_CUSTOM:
        finalHeader = authCustomHeader;
        break;
      case PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_BEARER:
        finalHeader = `Bearer ${bearerToken}`;
        break;
    }

    // create an array from the (trimmed) comma separated string
    const ociRepoList = ociRepositories.length
      ? ociRepositories?.split(",").map(r => r.trim())
      : [];

    // If the scheme is not specified, assume HTTPS. This is common for OCI registries
    // unless using the kapp plugin, which explicitly should not include https:// protocol prefix
    let finalURL = url;
    if (plugin?.name !== PluginNames.PACKAGES_KAPP && !url?.startsWith("http")) {
      finalURL = `https://${url}`;
    }

    // build the IAppRepositoryFilter object based on the filter names plus the regex and exclude options
    let filter: IPkgRepositoryFilter | undefined;
    if (type === RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_HELM && filterNames !== "") {
      filter = toFilterRule(filterNames, filterRegex, filterExclude);
    }

    const success = await onSubmit({
      authHeader: finalHeader,
      authMethod,
      basicAuth: {
        password: basicPassword,
        username: basicUser,
      } as UsernamePassword,
      customCA,
      customDetails: {
        ociRepositories: ociRepoList,
        performValidation,
        filterRule: filter,
        // TODO(agamez): set this value when supporting user-managed secrets
        dockerRegistrySecrets: [],
      } as RepositoryCustomDetails,
      description,
      dockerRegCreds: {
        username: secretUser,
        email: secretEmail,
        password: secretPassword,
        server: secretServer,
      } as DockerCredentials,
      interval,
      name,
      passCredentials,
      plugin,
      // TODO(agamez): set this value when supporting user-managed secrets
      secretAuthName: "",
      // TODO(agamez): set this value when supporting user-managed secrets
      secretTLSName: "",
      skipTLS,
      type,
      url: finalURL,
    } as IPkgRepoFormData);
    if (success && onAfterInstall) {
      onAfterInstall();
    }
    isInstallingRef.current = false;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
  };
  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInterval(Number(e.target.value));
  };
  const handlePerformValidationChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    setPerformValidation(!performValidation);
  };
  const handleURLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setURL(e.target.value);
  };
  const handleAuthCustomHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAuthCustomHeader(e.target.value);
  };
  const handleAuthBearerTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBearerToken(e.target.value);
  };
  const handleCustomCAChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCustomCA(e.target.value);
  };
  const handleAuthRadioButtonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAuthMethod(PackageRepositoryAuth_PackageRepositoryAuthType[e.target.value]);
  };
  const handleTypeRadioButtonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setType(e.target.value);
  };
  const handlePluginRadioButtonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlugin(getPluginByName(e.target.value));
    // suggest a type per plugin
    switch (getPluginByName(e.target.value)?.name) {
      case PluginNames.PACKAGES_HELM:
      case PluginNames.PACKAGES_FLUX:
        setType(RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_HELM);
        break;
      case PluginNames.PACKAGES_KAPP:
        setType(RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_CARVEL_IMGPKGBUNDLE);
        break;
    }
  };
  const handleBasicUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBasicUser(e.target.value);
  };
  const handleBasicPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBasicPassword(e.target.value);
  };
  const handleOCIRepositoriesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setOCIRepositories(e.target.value);
  };
  const handleSkipTLSChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    setSkipTLS(!skipTLS);
  };
  const handlePassCredentialsChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    setPassCredentials(!passCredentials);
  };
  const handleFilterNamesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFilterNames(e.target.value);
  };
  const handleFilterRegexChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterRegex(!filterRegex);
  };
  const handleFilterExcludeChange = (_e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterExclude(!filterExclude);
  };
  const handleAuthSecretUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSecretUser(e.target.value);
  };
  const handleAuthSecretPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSecretPassword(e.target.value);
  };
  const handleAuthSecretEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSecretEmail(e.target.value);
  };
  const handleAuthSecretServerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSecretServer(e.target.value);
  };

  const parseValidationError = (error: Error) => {
    let message = error.message;
    try {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.code && parsedMessage.message) {
        message = `Code: ${parsedMessage.code}. Message: ${parsedMessage.message}`;
      }
    } catch (e: any) {
      // Not a json message
    }
    return message;
  };

  /* eslint-disable jsx-a11y/label-has-associated-control */
  return (
    <>
      <form onSubmit={handleInstallClick}>
        <CdsAccordion>
          <CdsAccordionPanel expanded={accordion[0]}>
            <CdsAccordionHeader onClick={() => toggleAccordion(0)}>
              Basic information
            </CdsAccordionHeader>
            <CdsAccordionContent>
              <CdsFormGroup layout="vertical">
                <CdsInput>
                  <label>Name</label>
                  <input
                    id="kubeapps-repo-name"
                    type="text"
                    placeholder="example"
                    value={name}
                    onChange={handleNameChange}
                    required={true}
                    pattern="[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*"
                    title="Use lower case alphanumeric characters, '-' or '.'"
                    disabled={repo?.name ? true : false}
                  />
                </CdsInput>
                <CdsInput>
                  <label> URL </label>
                  <input
                    id="kubeapps-repo-url"
                    type="text"
                    placeholder="https://charts.example.com/stable"
                    value={url}
                    onChange={handleURLChange}
                    required={true}
                  />
                </CdsInput>
                <CdsInput>
                  <label> Description (optional)</label>
                  <input
                    id="kubeapps-repo-description"
                    type="text"
                    placeholder="Description of the repository"
                    value={description}
                    onChange={handleDescriptionChange}
                    required={false}
                  />
                </CdsInput>
                {/* TODO(agamez): these plugin selectors should be loaded
                based on the current plugins that are loaded in the cluster */}
                <CdsRadioGroup layout="vertical">
                  <label>Packaging Format:</label>
                  <CdsControlMessage>Select the plugin to use.</CdsControlMessage>
                  <CdsRadio>
                    <label>{getPluginPackageName(PluginNames.PACKAGES_HELM)}</label>
                    <input
                      id="kubeapps-plugin-helm"
                      type="radio"
                      name="plugin"
                      value={PluginNames.PACKAGES_HELM}
                      checked={plugin?.name === PluginNames.PACKAGES_HELM}
                      onChange={handlePluginRadioButtonChange}
                      disabled={repo.packageRepoRef?.plugin ? true : false}
                      required={true}
                    />
                  </CdsRadio>
                  <CdsRadio>
                    <label>{getPluginPackageName(PluginNames.PACKAGES_FLUX)}</label>
                    <input
                      id="kubeapps-plugin-fluxv2"
                      type="radio"
                      name="plugin"
                      value={PluginNames.PACKAGES_FLUX}
                      checked={plugin?.name === PluginNames.PACKAGES_FLUX}
                      onChange={handlePluginRadioButtonChange}
                      disabled={repo.packageRepoRef?.plugin ? true : false}
                      required={true}
                    />
                  </CdsRadio>
                  <CdsRadio>
                    <label>{getPluginPackageName(PluginNames.PACKAGES_KAPP)}</label>
                    <input
                      id="kubeapps-plugin-kappcontroller"
                      type="radio"
                      name="plugin"
                      value={PluginNames.PACKAGES_KAPP}
                      checked={plugin?.name === PluginNames.PACKAGES_KAPP}
                      onChange={handlePluginRadioButtonChange}
                      disabled={repo.packageRepoRef?.plugin ? true : false}
                      required={true}
                    />
                  </CdsRadio>
                </CdsRadioGroup>
                {plugin?.name && (
                  <CdsRadioGroup layout="vertical">
                    <label>Package Storage Type</label>
                    <CdsControlMessage>Select the package storage type.</CdsControlMessage>
                    {(plugin?.name === (PluginNames.PACKAGES_HELM as string) ||
                      plugin?.name === (PluginNames.PACKAGES_FLUX as string)) && (
                      <>
                        <CdsRadio>
                          <label>Helm Repository</label>
                          <input
                            id="kubeapps-repo-type-helm"
                            type="radio"
                            name="type"
                            value={RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_HELM}
                            checked={
                              type === RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_HELM
                            }
                            disabled={!!repo?.type}
                            onChange={handleTypeRadioButtonChange}
                            required={
                              plugin?.name === (PluginNames.PACKAGES_HELM as string) ||
                              plugin?.name === (PluginNames.PACKAGES_FLUX as string)
                            }
                          />
                        </CdsRadio>
                        <CdsRadio>
                          <label>OCI Registry</label>
                          <input
                            id="kubeapps-repo-type-oci"
                            type="radio"
                            name="type"
                            // TODO(agamez): workaround until Flux plugin also supports OCI artifacts
                            disabled={plugin?.name === PluginNames.PACKAGES_FLUX || !!repo?.type}
                            value={RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_OCI}
                            checked={type === RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_OCI}
                            onChange={handleTypeRadioButtonChange}
                            required={
                              plugin?.name === (PluginNames.PACKAGES_HELM as string) ||
                              plugin?.name === (PluginNames.PACKAGES_FLUX as string)
                            }
                          />
                        </CdsRadio>
                      </>
                    )}
                    {plugin?.name === PluginNames.PACKAGES_KAPP && (
                      <>
                        <CdsRadio>
                          <label>Imgpkg Bundle</label>
                          <input
                            id="kubeapps-repo-type-imgpkgbundle"
                            type="radio"
                            name="type"
                            disabled={!!repo?.type}
                            value={
                              RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_CARVEL_IMGPKGBUNDLE
                            }
                            checked={
                              type ===
                              RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_CARVEL_IMGPKGBUNDLE
                            }
                            onChange={handleTypeRadioButtonChange}
                            required={plugin?.name === PluginNames.PACKAGES_KAPP}
                          />
                        </CdsRadio>
                        <CdsRadio>
                          <label>Inline</label>
                          <input
                            id="kubeapps-repo-type-inline"
                            type="radio"
                            name="type"
                            disabled={!!repo?.type}
                            value={RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_CARVEL_INLINE}
                            checked={
                              type ===
                              RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_CARVEL_INLINE
                            }
                            onChange={handleTypeRadioButtonChange}
                            required={plugin?.name === PluginNames.PACKAGES_KAPP}
                          />
                        </CdsRadio>
                        <CdsRadio>
                          <label>Image</label>
                          <input
                            id="kubeapps-repo-type-image"
                            type="radio"
                            name="type"
                            disabled={!!repo?.type}
                            value={RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_CARVEL_IMAGE}
                            checked={
                              type ===
                              RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_CARVEL_IMAGE
                            }
                            onChange={handleTypeRadioButtonChange}
                            required={plugin?.name === PluginNames.PACKAGES_KAPP}
                          />
                        </CdsRadio>
                        <CdsRadio>
                          <label>HTTP</label>
                          <input
                            id="kubeapps-repo-type-http"
                            type="radio"
                            name="type"
                            disabled={!!repo?.type}
                            value={RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_CARVEL_HTTP}
                            checked={
                              type === RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_CARVEL_HTTP
                            }
                            onChange={handleTypeRadioButtonChange}
                            required={plugin?.name === PluginNames.PACKAGES_KAPP}
                          />
                        </CdsRadio>
                        <CdsRadio>
                          <label>Git</label>
                          <input
                            id="kubeapps-repo-type-git"
                            type="radio"
                            name="type"
                            disabled={!!repo?.type}
                            value={RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_CARVEL_GIT}
                            checked={
                              type === RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_CARVEL_GIT
                            }
                            onChange={handleTypeRadioButtonChange}
                            required={plugin?.name === PluginNames.PACKAGES_KAPP}
                          />
                        </CdsRadio>
                      </>
                    )}
                  </CdsRadioGroup>
                )}
              </CdsFormGroup>
            </CdsAccordionContent>
          </CdsAccordionPanel>

          <CdsAccordionPanel expanded={accordion[1]}>
            <CdsAccordionHeader onClick={() => toggleAccordion(1)}>
              Authentication
            </CdsAccordionHeader>
            <CdsAccordionContent>
              <CdsFormGroup layout="vertical">
                <div cds-layout="grid gap:lg">
                  <CdsRadioGroup cds-layout="col@xs:4">
                    <label>Repository Authorization</label>
                    <CdsRadio>
                      <label>None (Public)</label>
                      <input
                        id="kubeapps-repo-auth-method-none"
                        type="radio"
                        name="auth"
                        value={
                          PackageRepositoryAuth_PackageRepositoryAuthType[
                            PackageRepositoryAuth_PackageRepositoryAuthType
                              .PACKAGE_REPOSITORY_AUTH_TYPE_UNSPECIFIED
                          ]
                        }
                        checked={
                          authMethod ===
                          PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_UNSPECIFIED
                        }
                        onChange={handleAuthRadioButtonChange}
                      />
                    </CdsRadio>
                    <CdsRadio>
                      <label>Basic Auth</label>
                      <input
                        id="kubeapps-repo-auth-method-basic"
                        type="radio"
                        name="auth"
                        value={
                          PackageRepositoryAuth_PackageRepositoryAuthType[
                            PackageRepositoryAuth_PackageRepositoryAuthType
                              .PACKAGE_REPOSITORY_AUTH_TYPE_BASIC_AUTH
                          ]
                        }
                        checked={
                          authMethod ===
                          PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_BASIC_AUTH
                        }
                        onChange={handleAuthRadioButtonChange}
                      />
                    </CdsRadio>
                    <CdsRadio>
                      <label>Bearer Token</label>
                      <input
                        id="kubeapps-repo-auth-method-bearer"
                        type="radio"
                        name="auth"
                        value={
                          PackageRepositoryAuth_PackageRepositoryAuthType[
                            PackageRepositoryAuth_PackageRepositoryAuthType
                              .PACKAGE_REPOSITORY_AUTH_TYPE_BEARER
                          ]
                        }
                        checked={
                          authMethod ===
                          PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_BEARER
                        }
                        onChange={handleAuthRadioButtonChange}
                      />
                    </CdsRadio>
                    <CdsRadio>
                      <label>Use Docker Registry Credentials</label>
                      <input
                        id="kubeapps-repo-auth-method-registry"
                        type="radio"
                        name="auth"
                        value={
                          PackageRepositoryAuth_PackageRepositoryAuthType[
                            PackageRepositoryAuth_PackageRepositoryAuthType
                              .PACKAGE_REPOSITORY_AUTH_TYPE_DOCKER_CONFIG_JSON
                          ]
                        }
                        checked={
                          authMethod ===
                          PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_DOCKER_CONFIG_JSON
                        }
                        onChange={handleAuthRadioButtonChange}
                      />
                    </CdsRadio>
                    <CdsRadio>
                      <label>Custom Authorization Header</label>
                      <input
                        id="kubeapps-repo-auth-method-custom"
                        type="radio"
                        name="auth"
                        value={
                          PackageRepositoryAuth_PackageRepositoryAuthType[
                            PackageRepositoryAuth_PackageRepositoryAuthType
                              .PACKAGE_REPOSITORY_AUTH_TYPE_CUSTOM
                          ]
                        }
                        checked={
                          authMethod ===
                          PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_CUSTOM
                        }
                        onChange={handleAuthRadioButtonChange}
                      />
                    </CdsRadio>
                  </CdsRadioGroup>

                  <div cds-layout="col@xs:8">
                    <div
                      id="kubeapps-repo-auth-details-basic"
                      hidden={
                        authMethod !==
                        PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_BASIC_AUTH
                      }
                    >
                      <CdsInput>
                        <label>Username</label>
                        <input
                          id="kubeapps-repo-username"
                          type="text"
                          value={basicUser}
                          onChange={handleBasicUserChange}
                          placeholder="username"
                          required={
                            authMethod ===
                            PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_BASIC_AUTH
                          }
                        />
                      </CdsInput>
                      <br />
                      <CdsInput>
                        <label>Password</label>
                        <input
                          id="kubeapps-repo-password"
                          type="password"
                          value={basicPassword}
                          onChange={handleBasicPasswordChange}
                          placeholder="password"
                          required={
                            authMethod ===
                            PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_BASIC_AUTH
                          }
                        />
                      </CdsInput>
                    </div>

                    <div
                      id="kubeapps-repo-auth-details-bearer"
                      hidden={
                        authMethod !==
                        PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_BEARER
                      }
                    >
                      <CdsInput>
                        <label>Token</label>
                        <input
                          type="text"
                          value={bearerToken}
                          onChange={handleAuthBearerTokenChange}
                          id="kubeapps-repo-token"
                          placeholder="xrxNcWghpRLdcPHFgVRM73rr4N7qjvjm"
                          required={
                            authMethod ===
                            PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_BEARER
                          }
                        />
                      </CdsInput>
                    </div>
                    <div
                      id="kubeapps-repo-auth-details-docker"
                      hidden={
                        authMethod !==
                        PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_DOCKER_CONFIG_JSON
                      }
                    >
                      <CdsInput className="margin-t-sm">
                        <label>Server</label>
                        <input
                          id="kubeapps-docker-cred-server"
                          value={secretServer}
                          onChange={handleAuthSecretServerChange}
                          placeholder="https://index.docker.io/v1/"
                          required={
                            authMethod ===
                            PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_DOCKER_CONFIG_JSON
                          }
                        />
                      </CdsInput>
                      <CdsInput className="margin-t-sm">
                        <label>Username</label>
                        <input
                          id="kubeapps-docker-cred-username"
                          value={secretUser}
                          onChange={handleAuthSecretUserChange}
                          placeholder="Username"
                          required={
                            authMethod ===
                            PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_DOCKER_CONFIG_JSON
                          }
                        />
                      </CdsInput>
                      <CdsInput className="margin-t-sm">
                        <label>Password</label>
                        <input
                          id="kubeapps-docker-cred-password"
                          type="password"
                          value={secretPassword}
                          onChange={handleAuthSecretPasswordChange}
                          placeholder="Password"
                          required={
                            authMethod ===
                            PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_DOCKER_CONFIG_JSON
                          }
                        />
                      </CdsInput>
                      <CdsInput className="margin-t-sm">
                        <label>Email</label>
                        <input
                          id="kubeapps-docker-cred-email"
                          value={secretEmail}
                          onChange={handleAuthSecretEmailChange}
                          placeholder="user@example.com"
                        />
                      </CdsInput>
                    </div>

                    <div
                      id="kubeapps-repo-auth-details-custom"
                      hidden={
                        authMethod !==
                        PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_CUSTOM
                      }
                    >
                      <CdsInput>
                        <label>Raw Authorization Header</label>
                        <input
                          id="kubeapps-repo-custom-header"
                          type="text"
                          placeholder="MyAuth xrxNcWghpRLdcPHFgVRM73rr4N7qjvjm"
                          value={authCustomHeader}
                          onChange={handleAuthCustomHeaderChange}
                          required={
                            authMethod ===
                            PackageRepositoryAuth_PackageRepositoryAuthType.PACKAGE_REPOSITORY_AUTH_TYPE_CUSTOM
                          }
                        />
                      </CdsInput>
                    </div>
                  </div>
                </div>
              </CdsFormGroup>
            </CdsAccordionContent>
          </CdsAccordionPanel>

          <CdsAccordionPanel
            expanded={accordion[2]}
            hidden={
              type !== RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_OCI &&
              plugin?.name !== PluginNames.PACKAGES_HELM
            }
          >
            <CdsAccordionHeader onClick={() => toggleAccordion(2)}>Filtering</CdsAccordionHeader>
            <CdsAccordionContent>
              <CdsFormGroup layout="vertical">
                {type === RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_OCI && (
                  <CdsTextarea>
                    <label htmlFor="kubeapps-oci-repositories">
                      List of Repositories (required)
                    </label>
                    <CdsControlMessage>
                      Include a list of comma-separated OCI repositories that will be available in
                      Kubeapps.
                    </CdsControlMessage>
                    <textarea
                      id="kubeapps-oci-repositories"
                      className="cds-textarea-fix"
                      placeholder={"nginx, jenkins"}
                      value={ociRepositories}
                      onChange={handleOCIRepositoriesChange}
                      required={type === RepositoryStorageTypes.PACKAGE_REPOSITORY_STORAGE_OCI}
                    />
                  </CdsTextarea>
                )}
                {/* TODO(agamez): workaround until Flux plugin also supports OCI artifacts */}
                {plugin?.name === PluginNames.PACKAGES_HELM && (
                  <>
                    <CdsTextarea>
                      <label>Filter Applications (optional)</label>
                      <CdsControlMessage>
                        Comma-separated list of applications to be included or excluded (all will be
                        included by default).
                      </CdsControlMessage>
                      <textarea
                        className="cds-textarea-fix"
                        id="kubeapps-repo-filter-repositories"
                        placeholder={"nginx, jenkins"}
                        value={filterNames}
                        onChange={handleFilterNamesChange}
                      />
                    </CdsTextarea>
                    <CdsCheckbox className="ca-skip-tls">
                      <label>Exclude Packages</label>
                      <CdsControlMessage>
                        Exclude packages matching the given filter
                      </CdsControlMessage>
                      <input
                        id="kubeapps-repo-filter-exclude"
                        type="checkbox"
                        onChange={handleFilterExcludeChange}
                        checked={filterExclude}
                      />
                    </CdsCheckbox>
                    <CdsCheckbox className="ca-skip-tls">
                      <label>Regular Expression</label>
                      <CdsControlMessage>
                        Mark this box to treat the filter as a regular expression
                      </CdsControlMessage>
                      <input
                        id="kubeapps-repo-filter-regex"
                        type="checkbox"
                        onChange={handleFilterRegexChange}
                        checked={filterRegex}
                      />
                    </CdsCheckbox>
                  </>
                )}
              </CdsFormGroup>
            </CdsAccordionContent>
          </CdsAccordionPanel>

          <CdsAccordionPanel expanded={accordion[3]}>
            <CdsAccordionHeader onClick={() => toggleAccordion(3)}>Advanced</CdsAccordionHeader>
            <CdsAccordionContent>
              <CdsFormGroup layout="vertical">
                <CdsInput>
                  <label>Synchronization Interval</label>
                  <input
                    id="kubeapps-repo-interval"
                    type="number"
                    placeholder="Synchronization interval in seconds"
                    value={interval}
                    onChange={handleIntervalChange}
                    required={false}
                  />
                  <CdsControlMessage>
                    Time (in seconds) to wait between synchronizing the repository.
                  </CdsControlMessage>
                </CdsInput>
                {plugin?.name === PluginNames.PACKAGES_HELM && (
                  <CdsCheckbox>
                    <label>Perform Validation</label>
                    <CdsControlMessage>
                      Ensure that a connection can be established with the repository before adding
                      it.
                    </CdsControlMessage>
                    <input
                      id="kubeapps-repo-performvalidation"
                      type="checkbox"
                      onChange={handlePerformValidationChange}
                      checked={performValidation}
                    />
                  </CdsCheckbox>
                )}
                <CdsTextarea layout="vertical">
                  <label>Custom CA Certificate (optional)</label>
                  <textarea
                    id="kubeapps-repo-custom-ca"
                    placeholder={"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"}
                    className="cds-textarea-fix"
                    value={customCA}
                    disabled={skipTLS}
                    onChange={handleCustomCAChange}
                  />
                  <CdsControlMessage>
                    Custom Certificate Authority (CA) to use when connecting to the repository.
                  </CdsControlMessage>
                </CdsTextarea>
                <CdsCheckbox className="ca-skip-tls">
                  <label className="clr-control-label">Skip TLS Verification</label>
                  <input
                    id="kubeapps-repo-skip-tls"
                    type="checkbox"
                    checked={skipTLS}
                    onChange={handleSkipTLSChange}
                  />
                  <CdsControlMessage>
                    If enabled, the TLS certificate will not be verified (potentially insecure).
                  </CdsControlMessage>
                </CdsCheckbox>
                <CdsCheckbox className="ca-skip-tls">
                  <label className="clr-control-label">Pass Credentials to 3rd party URLs</label>
                  <input
                    id="kubeapps-repo-pass-credentials"
                    type="checkbox"
                    checked={passCredentials}
                    onChange={handlePassCredentialsChange}
                  />
                  <CdsControlMessage>
                    If enabled, the same credentials will be sent to those URLs for fetching the
                    icon and the tarball files (potentially insecure).
                  </CdsControlMessage>
                </CdsCheckbox>
              </CdsFormGroup>
            </CdsAccordionContent>
          </CdsAccordionPanel>
        </CdsAccordion>

        {namespace === kubeappsNamespace && (
          <p>
            <strong>NOTE:</strong> This Package Repository will be created in the "
            {kubeappsNamespace}" global namespace. Consequently, its packages will be available for
            installation in every namespace and cluster.
          </p>
        )}
        {validationError && (
          <Alert theme="danger">
            Validation Failed. Got: {parseValidationError(validationError)}
          </Alert>
        )}
        {createError && (
          <Alert theme="danger">
            An error occurred while creating the repository: {createError.message}
          </Alert>
        )}
        {updateError && (
          <Alert theme="danger">
            An error occurred while updating the repository: {updateError.message}
          </Alert>
        )}
        <div className="margin-t-xl">
          <CdsButton type="submit" disabled={validating}>
            {validating
              ? "Validating..."
              : `${repo.name ? `Update '${repo.name}'` : "Install"} Repository`}
          </CdsButton>
        </div>
      </form>
    </>
  );
}
