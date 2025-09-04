import React, { FC } from "react"
import { FixedStorageProps, LocalStorageText } from "./LocalStorage/Text";

export const ServerName: FC<FixedStorageProps> = (props) => {

    const {
        placeholder = "my-cool-server",
        ...rest
    } = props

        return <LocalStorageText storageKey="serverName" placeholder={placeholder} sensitive {...rest}/>;
}

export const HostDirectory: FC<FixedStorageProps> = (props) => {

    const {
        placeholder = "/home/myUser/homelab",
        ...rest
    } = props

        return <LocalStorageText storageKey="hostDirectory" placeholder={placeholder} {...rest}/>;
}

export const KomodoUrl: FC<FixedStorageProps> = (props) => {

    const {
        placeholder = "http://192.168.0.101:8120",
        ...rest
    } = props

        return <LocalStorageText storageKey="komodoUrl" sensitive placeholder={placeholder} {...rest}/>;
}

export const KomodoApiKey: FC<FixedStorageProps> = (props) => {

    const {
        placeholder = "K-3A6btIPZYeBuD5ebSa9uD5ebuD5ebHIjYxT5sc",
        ...rest
    } = props

        return <LocalStorageText storageKey="komodoApiKey" sensitive placeholder={placeholder} {...rest}/>;
}

export const KomodoApiSecret: FC<FixedStorageProps> = (props) => {

    const {
        placeholder = "S-qnaXD1frutYlfC2ZYlfCSzqiYlfC1WYlfCVR34Yj4",
        ...rest
    } = props

        return <LocalStorageText storageKey="komodoApiSecret" sensitive placeholder={placeholder} {...rest}/>;
}