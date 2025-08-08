import { _PartialStackConfig } from "komodo_client/dist/types.js"

export interface TomlStack {
    name: string
    config: _PartialStackConfig & { server: string }
}