import React, { Fragment, useState, useEffect, PropsWithChildren, ReactHTMLElement, useCallback } from "react"
import {Document, parseDocument} from 'yaml';
import {YAMLMap, YAMLSeq, Pair, Scalar} from "yaml";
import Error from "@theme/Error";
import ErrorBoundary from "@docusaurus/ErrorBoundary"
import BrowserOnly from '@docusaurus/BrowserOnly';
import Admonition from '@theme/Admonition';
import { useTypedLocalStorage } from "../useLocalStorage";
// to make this work need to create plugin to override webpack loader
// https://github.com/facebook/docusaurus/issues/4445#issuecomment-1980332815
// https://github.com/facebook/docusaurus/issues/4445#issuecomment-1249276192
// @ts-ignore
import ComposeExample from './compose.yaml?raw';
// @ts-ignore
import SocketProxyExample from './socket-proxy.yaml?raw';
import CodeBlock from '@theme/CodeBlock';

const doc = parseDocument(ComposeExample);
const proxyCollection = parseDocument(SocketProxyExample);

const DOT_FOLDER_REGEX = new RegExp(/(?:^|[\/\\])\.\S/);

interface ComposeStateData {
    autoUpdate?: boolean
    pollUpdate?: boolean
    stacksFrom?: 'dir' | 'compose',
    api?: boolean
    //hostDir?: string
}

const QSCompose = (props) => {

        const [storageStacksFromVal, setStorageStacksFromVal] = useTypedLocalStorage('docusaurus.tab.stacksFrom', 'dir', false);
        const [storageSyncApiVal, setStorageSyncApiVal] = useTypedLocalStorage('syncApi', false);
    
        const [userDoc, setUserDoc] = useState(doc);
    
        const [storageHostVal] = useTypedLocalStorage('hostDirectory', "");
    
        const [serverValue] = useTypedLocalStorage('serverName', "");
    
        const [komodoUrlValue] = useTypedLocalStorage('komodoUrl', "");
    
        const [apiKeyValue] = useTypedLocalStorage('komodoApiKey', "");
    
        const [komodoSec] = useTypedLocalStorage('komodoApiSecret', "");
    
        useEffect(() => {
    
        const modifiedDoc = doc.clone();
    
        const hostPath = storageHostVal !== undefined && storageHostVal.trim() !== '' ? storageHostVal : '/home/myUser/homelab';
        const hostPathS = new Scalar(`${hostPath}:/filesOnServer`);
        hostPathS.commentBefore = `# ${storageStacksFromVal=== 'dir' ? 'Parent directory where all subfolders are compose projects' : 'Top-most directory that contains all folders (at any level) that compose projects are found in'}`
    
        modifiedDoc.setIn(['services','komodo-import','volumes', 0], hostPathS);
    
        modifiedDoc.setIn(['services','komodo-import','environment'], new YAMLSeq());
    
        const seq = modifiedDoc.getIn(['services','komodo-import','environment']) as YAMLSeq;
    
    
        const hostS = new Scalar(`HOST_PARENT_PATH=${hostPath}`);
        hostS.commentBefore = `# Same as mounted directory above`
        seq.add(hostS);
    
        if(DOT_FOLDER_REGEX.test(hostPath)) {
            const dotS = new Scalar(`GLOB_DOT=true`);
            dotS.commentBefore = `# Forces glob to not ignore dot folders`
            seq.add(dotS);    
        }
    
        const stacksFromS = new Scalar(`STACKS_FROM=${storageStacksFromVal}`);
        stacksFromS.commentBefore = '# Determines what sources to generate Stacks from'
        stacksFromS.comment = `# ${storageStacksFromVal === 'dir' ? 'Generate stacks from subfolders in directory' : 'Generate stacks from compose projects'}`
        seq.add(stacksFromS);
    
        const serverS = new Scalar(`SERVER_NAME=${serverValue !== undefined && serverValue.trim() !== '' ? serverValue : 'my-cool-server'}`);
        serverS.commentBefore = '# Name of Server for this machine, in Komodo'
        seq.add(serverS);
        
        if(storageSyncApiVal) {
            const urlS = new Scalar(`KOMODO_URL=${komodoUrlValue === '' ? 'http://192.168.KOMOMDO.IP:8120' : komodoUrlValue}`);
            urlS.spaceBefore = true;
            urlS.commentBefore = '# Configuration for interacting with Komodo API';
            seq.add(urlS);
            seq.add(`API_KEY=${apiKeyValue === '' ? 'K-3A6btIPZYeBu_EXAMPLE_KEY' : apiKeyValue}`);
            seq.add(`API_SECRET=${komodoSec === '' ? 'S-qnaXD1frutYlfC2ZYl_EXAMPLE_SECRET' : komodoSec}`);
            const syncS = new Scalar('OUTPUT_API_SYNC=true');
            syncS.comment = 'Create Sync Resource in Komodo'
            seq.add(syncS);
        }
    
        if(storageStacksFromVal === 'compose') {
            const dockerS = new Scalar('DOCKER_HOST=tcp://socket-proxy:2375');
            dockerS.spaceBefore = true;
            dockerS.commentBefore = 'Tells Komodo Import how to connect to Docker';
    
            seq.add(dockerS);
            const d = new YAMLSeq();
            d.add('socket-proxy');
            modifiedDoc.setIn(['services', 'komodo-import', 'depends_on'], d);
            modifiedDoc.setIn(['services', 'socket-proxy'], proxyCollection.get('socket-proxy'));
            const proxy = modifiedDoc.getIn(['services', 'socket-proxy']) as YAMLMap;
            proxy.commentBefore = `# used to communicate with docker daemon`
        }
    
    
        // if(composeState.autoUpdate) {
        //     seq.add('AUTO_UPDATE=true')
        // }
        // if(composeState.pollUpdate) {
        //     seq.add('POLL_FOR_UPDATE=true')
        // }
    
    
        // @ts-ignore
        setUserDoc(modifiedDoc);
    
        }, [storageSyncApiVal, storageStacksFromVal, storageHostVal, serverValue, apiKeyValue, komodoSec, komodoUrlValue, setUserDoc]);
    
        return <CodeBlock className="rr-block .rr-block" title="compose.yaml" language="yaml">{userDoc.toString()}</CodeBlock>;

}

const WrappedQSCompose = (props) => {
    return <ErrorBoundary
        fallback={({error}) => (
            <div>
            <Admonition type="danger">
                <p>Interactive Quickstart compose.yaml crashed because of error! Sorry.</p>
                <CodeBlock>{error.stack}</CodeBlock>
            </Admonition>
            </div>
        )}
    ><BrowserOnly>{() => <QSCompose {...props} />}</BrowserOnly></ErrorBoundary>
}

export default WrappedQSCompose;