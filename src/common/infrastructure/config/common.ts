export interface CommonImportOptions {
    server: string
    imageRegistryProvider?: string
    imageRegistryAccount?: string
    autoUpdate?: boolean
    pollForUpdate?: boolean
    komodoEnvName?: string
    composeFileGlob?: string
    envFileGlob?: string
}