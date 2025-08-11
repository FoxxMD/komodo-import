# komodo-import <!-- omit from toc -->

[![Latest Release](https://img.shields.io/github/v/release/foxxmd/komodo-import)](https://github.com/FoxxMD/komodo-import/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Pulls](https://img.shields.io/docker/pulls/foxxmd/komodo-import)](https://hub.docker.com/r/foxxmd/komodo-import)

Generate TOML [Sync Resources](https://komo.do/docs/sync-resources) for [Komodo](https://komo.do) from your existing Docker Compose projects. The missing import tool for onboarding Komodo!

**🚧 VERY alpha development!**

- [Overview](#overview)
- [Usage](#usage)
  - [Generate "Files On Server" Stacks](#generate-files-on-server-stacks)
  - [File Pattern Behavior](#file-pattern-behavior)
- [Using Sync Resources](#using-sync-resources)
  - [Generate TOML](#generate-toml)
  - [Create Sync Resource](#create-sync-resource)
  - [Verify Sync Changes](#verify-sync-changes)
  - [Execute Sync](#execute-sync)
  - [Remove Sync (Optional)](#remove-sync-optional)
- [Example/Demo](#exampledemo)
- [Writing Generated TOML to File](#writing-generated-toml-to-file)

## Overview

Komodo Import is a small docker container that takes some user-provided configuration, reads **existing** folder structures on your machine, and generates TOML [Sync Resources](https://komo.do/docs/sync-resources) to use with Komodo.

Current functionality:

* [x] Generate TOML
   * [x] To Docker Logs
   * [x] To File
* [ ] Generate Toml For...
  * [x] Stack
     * [x] "Files On Server" Stack types   
     * [ ] Git Repo
* [ ]  Import directly with Komodo API
  
## Usage

Use the example [`compose.yaml`](./compose.yaml) stack to configure and run Komodo Import. **All configuration is done using Environmental Variables.**

Refer to the below "Generate ..." sections to see how to configure Komodo Import to genrate specific types of Stacks.

**See the [Example Demo](#exampledemo) for a concrete example of configuring and using Komodo Import.**

### Generate "Files On Server" Stacks

If you are using plain, non git-based folders containing `*compose.yaml`  style docker compose projects this is the import you want to use. AKA migrating from [dockge](https://github.com/louislam/dockge).

<details>

<summary>Configuration</summary>



|            ENV            |   Required    | Default |                                                                        Description                                                                         |
|---------------------------|---------------|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `SERVER_NAME`             | ☑️            |         | The name of the Komodo [Server](https://komo.do/docs/resources#server) where a Stack is located                                                            |
| `HOST_PARENT_PATH`        | ☑️            |         | The parent directory on the **host** where stack folders are located. Used for generating Stack Run Directory                                              |
| `COMPOSE_FILE_GLOB`       | -             |         | A [glob](https://github.com/isaacs/node-glob?tab=readme-ov-file#glob-primer) pattern to use for finding files for **Files Paths** in Stack config          |
| `ENV_FILE_GLOB`           | -             |         | A [glob](https://github.com/isaacs/node-glob?tab=readme-ov-file#glob-primer) pattern to use for finding files for **Additional Env Files** in Stack config |
| `KOMODO_ENV_NAME`         | `.komodoenv`  |         | If existing .env files are found then this name will be used for the .env that Komodo writes using its own Environment section                             |
| `IMAGE_REGISTRY_PROVIDER` | -             |         | Name of Image Registry to use                                                                                                                              |
| `IMAGE_REGISTRY_ACCOUNT`  | -             |         | Image Registry account to use                                                                                                                              |
| `POLL_FOR_UPDATE`         | -             | false   | Poll for newer images?                                                                                                                                     |
| `AUTO_UPDATE`             | -             | false   | Auto Update stack?                                                                                                                                         

</details>

### File Pattern Behavior

Komodo Import looks for necessary config files by searching the top-level project folder and all of its sub-folders.

* Compose Files
  * Default pattern
    * Looks for `compose.y(a)ml` and `docker-compose.y(a)ml` 
    * Files may have interim names like `compose.dev.yaml`
    * Can be overridden with `COMPOSE_FILE_GLOB` env
  * Will prioritize `compose.yaml` over `docker-compose.yaml`
  * Will choose the file with the shortest path EX
    * Prioritizes `./compose.yaml` over `./aFolder/compose.yaml`
* .env Files
  * Default pattern 
    * Adds all `.env` files found at top-level or sub-folders
    * Can be overridden with `ENV_FILE_GLOB` env
  * If a `.env` file is found then configures Komodo to write it's own Environment section to `.komodoenv` instead of `.env`
    * Komodo env name can be overridden with `KOMODO_ENV_NAME`

## Using Sync Resources

To use the TOML generated by this tool you will need to create a [Sync Resource](https://komo.do/docs/sync-resources), then use that to **Execute  a Sync** which will create the Stack/Resources/etc in Komodo.

Follow the steps below:

### Generate TOML

Generate TOML with Komodo Import.

### Create Sync Resource

* In your Komodo dashboard navigiate to **Syncs** -> **New Resource Sync**
* Create a Sync with whatever name you want
* In the Sync details page **Choose Mode** -> **UI Defined**
* ⚠️ Disable **Delete Unmatched Resources** ⚠️
  * If this is **not** disabled you may delete all other Resources in Komodo! Double check this!
* Add the Komodo Import TOML to **Resoure Files** section
* **Save**

### Verify Sync Changes

Your Sync should now be in a **Pending** state (check the top header). If it's not click the **Refresh** button to update.

Switching to the **Pending** tab now shows all of the actions Komodo will take to make it **match what is in the generated TOML.** This should generally *only* be "Update Stack" or "Create Stack" actions.

Verify that all of the actions are what you desire. If something is missing it can be updated by modifying the contents in **Resoure Files** in the **Config** tab.

### Execute Sync

Click the **Execute Sync** button to perform **all** the actions under **Pending**. Alternatively, use the **Execute Change** button next to each individual Action.

### Remove Sync (Optional)

After Syncing is done you can safely **Delete** the Sync you created for use with Komodo Import.

You may now want to create a proper [bi-directional, git-backed Sync](https://blog.foxxmd.dev/posts/migrating-to-komodo/#resource-sync) so your entire Komodo configuration is backed up and restorable.

## Example/Demo

<details>

* You have Komodo already setup
* You have installed [Periphery](https://komo.do/docs/connect-servers) on a machine
  * The Komodo Server name is `my-cool-server`
  * The machine is currently using dockge and has all of its compose projects located at `/home/myUser/homelab` like...
    * `/home/myUser/homelab/immich`
    * `/home/myUser/homelab/plex`
    * etc...

Using the [example `compose.yaml`](./compose.yaml) you modify it to fill in the required configuration:

```yaml
services:
  komodo-import:
    image: foxxmd/komodo-import:latest
    volumes:
      ## ParentDirectory:FILES_ON_SERVER_DIR
      - /home/myUser/homelab:/filesOnServer:ro
    environment:
      - TZ=America/New_York
      ## Komodo Server name to use for generated Stacks
      - SERVER_NAME=my-cool-server
      ## ParentDirectory on the host use as Stack Run Directory prefix
      - HOST_PARENT_PATH=/home/myUser/homelab
    restart: no
```

```shell
$ docker compose up
app is starting!
[2025-08-08 13:47:17.462 -0400] VERBOSE: [Init] Config Dir ENV: /config -> Resolved: /config
[2025-08-08 13:47:17.465 -0400] INFO   : [Init] Debug Mode: NO
[2025-08-08 13:47:17.476 -0400] INFO   : [App] Version: 0.1.0
[2025-08-08 13:47:17.477 -0400] INFO   : [App] Files On Server Dir ENV: /filesOnServer -> Resolved: /filesOnServer
[2025-08-08 13:47:17.479 -0400] INFO   : [App] [uptime_kuma] Found Stack 'uptime_kuma' at dir /filesOnServer/uptime_kuma
[2025-08-08 13:47:17.485 -0400] INFO   : [App] [uptime_kuma] Found 1 files matching compose pattern **/{compose,docker-compose}*.y?(a)ml:
compose.yaml
[2025-08-08 13:47:17.486 -0400] INFO   : [App] [uptime_kuma] Stack config complete
[2025-08-08 13:47:17.487 -0400] INFO   : [App] [immich] Found Stack 'immich' at dir /filesOnServer/immich
[2025-08-08 13:47:17.488 -0400] INFO   : [App] [immich] Found 1 files matching compose pattern **/{compose,docker-compose}*.y?(a)ml:
docker/docker-compose.yaml
[2025-08-08 13:47:17.489 -0400] INFO   : [App] [immich] Stack config complete
[2025-08-08 13:47:17.489 -0400] INFO   : [App] [plex] Found Stack 'plex' at dir /filesOnServer/plex
[2025-08-08 13:47:17.490 -0400] INFO   : [App] [plex] Found 1 files matching compose pattern **/{compose,docker-compose}*.y?(a)ml:
compose.yaml
[2025-08-08 13:47:17.491 -0400] INFO   : [App] [plex] Found 1 env files matching pattern **/.env:
.env
[2025-08-08 13:47:17.491 -0400] INFO   : [App] [plex] Using .komodoEnv for Komodo-written env file
[2025-08-08 13:47:17.492 -0400] INFO   : [App] [plex] Stack config complete
[2025-08-08 13:47:17.492 -0400] INFO   : [App] [homepage] Found Stack 'homepage' at dir /filesOnServer/homepage
[2025-08-08 13:47:17.493 -0400] INFO   : [App] [homepage] Found 3 files matching compose pattern **/{compose,docker-compose}*.y?(a)ml:
compose.yaml
docker-compose.yaml
docker/docker-compose.yaml
[2025-08-08 13:47:17.493 -0400] INFO   : [App] [homepage] Found 1 env files matching pattern **/.env:
.env
[2025-08-08 13:47:17.494 -0400] INFO   : [App] [homepage] Using .komodoEnv for Komodo-written env file
[2025-08-08 13:47:17.494 -0400] INFO   : [App] [homepage] Stack config complete
[2025-08-08 13:47:17.495 -0400] INFO   : [App] TOML:
[[stack]]
name = "uptime_kuma"

[stack.config]
server = "my-cool-server"
run_directory = "/home/myUser/homelab/uptime_kuma"
files_on_host = true
auto_update = false
poll_for_updates = false
file_paths = [ "compose.yaml" ]

[[stack]]
name = "immich"

[stack.config]
server = "my-cool-server"
run_directory = "/home/myUser/homelab/immich"
files_on_host = true
auto_update = false
poll_for_updates = false
file_paths = [ "docker/docker-compose.yaml" ]

[[stack]]
name = "plex"

[stack.config]
server = "my-cool-server"
run_directory = "/home/myUser/homelab/plex"
files_on_host = true
auto_update = false
poll_for_updates = false
file_paths = [ "compose.yaml" ]
env_file_path = ".komodoEnv"
additional_env_files = [ ".env" ]

[[stack]]
name = "homepage"

[stack.config]
server = "my-cool-server"
run_directory = "/home/myUser/homelab/homepage"
files_on_host = true
auto_update = false
poll_for_updates = false
file_paths = [ "compose.yaml" ]
env_file_path = ".komodoEnv"
additional_env_files = [ ".env" ]
[2025-08-08 13:47:17.496 -0400] INFO   : [App] Done!
```

Copy everything after `[2025-08-08 13:47:17.495 -0400] INFO   : [App] TOML:` up until the next timestamp -- this is the contents used in the [**Using Sync Resources**](#using-sync-resources) section.

**TIP**

Use

```
docker compose logs --no-log-prefix
```

after running Komodo Import to get output without the service name prefix, makes getting clear TOML output easier.

</details>

## Writing Generated TOML to File

Komodo Import will additionally attempt to write the generated output to a `.toml` file if the ENV `OUTPUT_DIR` is present. This should be the *directory* (not file) that the generated file should be written to.

Bind mount a folder into the container and set `OUTPUT_DIR` like in the example below:

<details>

<summary>File Output Example</summary>

```yaml
services:
  komodo-import:
  # ...
    environment:
      # ...
      - OUTPUT_DIR=/output
    volumes:
      # ...
      - /my/host/folder:/output
```

</details>