# komodo-import <!-- omit from toc -->

[![Latest Release](https://img.shields.io/github/v/release/foxxmd/komodo-import)](https://github.com/FoxxMD/komodo-import/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker Pulls](https://img.shields.io/docker/pulls/foxxmd/komodo-import)](https://hub.docker.com/r/foxxmd/komodo-import)

Generate TOML [Sync Resources](https://komo.do/docs/sync-resources) for [Komodo](https://komo.do) from your existing Docker Compose projects. The missing import tool for onboarding Komodo!

**🚧 VERY alpha development!**

Generate TOML [Sync Resources](https://komo.do/docs/sync-resources) for [Komodo](https://komo.do) from your existing Docker Compose projects. The missing import tool for onboarding Komodo!

## Overview

Komodo Import is a small docker container that takes some user-provided configuration, reads **existing** folder structures on your machine, and generates [Sync Resources](https://komo.do/docs/sync-resources) to use with Komodo.

Current functionality:

* [x] Generate TOML
   * [x] [To Docker Logs](https://foxxmd.github.io/komodo-import/docs/usage/overview#console)
   * [x] [To File](https://foxxmd.github.io/komodo-import/docs/usage/overview#file)
* [x] Generate Toml For...
  * [x] Stack
     * [x] ["Files On Server"](https://foxxmd.github.io/komodo-import/docs/usage/overview#files-on-server) Stack types   
     * [ ] Git Repo
* [x]  Import directly with Komodo API
  * [x] [Create/modify Resource Sync](https://foxxmd.github.io/komodo-import/docs/usage/overview#api-sync)
  * [ ] Create/modify Stacks
  * [ ] Create/modify Deployments

## Quick Start

[See the **Quick Start Guide**](https://foxxmd.github.io/komodo-import/docs/quickstart)

## Installation

[See the **Installation** documentation](https://foxxmd.github.io/komodo-import/docs/installation)

## Usage

[See the **Usage** documentation](https://foxxmd.github.io/komodo-import/docs/usage/overview)

## License

MIT
