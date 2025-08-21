import React, { Fragment, useState, useEffect, PropsWithChildren, ReactHTMLElement, useCallback } from "react"
import CodeBlock from '@theme/CodeBlock';
import CodeInline from '@theme/CodeInline';
import Admonition from '@theme/Admonition';
import MDXContent from "@theme/MDXContent";
import ErrorBoundary from "@docusaurus/ErrorBoundary"
import Button from './Button';
import ButtonGroup from './ButtonGroup';
import Error from "@theme/Error"
import {Document, parseDocument} from 'yaml';
import {YAMLMap, YAMLSeq, Pair, Scalar} from "yaml";
import { useDebounce } from "use-debounce";
//import ComposeExample from '!!raw-loader!@site/static/compose.txt';
//import ComposeExample from './compose.yaml?raw';

// to make this work need to create plugin to override webpack loader
// https://github.com/facebook/docusaurus/issues/4445#issuecomment-1980332815
// https://github.com/facebook/docusaurus/issues/4445#issuecomment-1249276192
import ComposeExample from './compose.yaml?raw';
import SocketProxyExample from './socket-proxy.yaml?raw';
import HostComposeSnippet from './QuickStartSnippets/hostDirCompose.mdx';
import HostSnippet from './QuickStartSnippets/hostDir.mdx';
import ConsoleOutput from './QuickStartSnippets/consoleOutput.mdx';
import ApiOutput from './QuickStartSnippets/apiOutput.mdx';

const doc = parseDocument(ComposeExample);
const proxyCollection = parseDocument(SocketProxyExample);

interface ComposeStateData {
    autoUpdate?: boolean
    pollUpdate?: boolean
    stacksFrom?: 'dir' | 'compose',
    api?: boolean
    //hostDir?: string
}

export interface AIOProps {
    data?: string
    client?: boolean
    name?: string
}

type CheckboxProps = PropsWithChildren<{
    id: string
    checked?: boolean
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}>

const Checkbox = (props: CheckboxProps) => {

    const {
        id,
        checked,
        children,
        onChange = () => null
    } = props;

    return <div className="margin-vert--sm">
            <input className="margin-right--sm" type="checkbox" id="vehicle3" name="vehicle3" onChange={onChange} checked={checked ?? false}/>
            <label htmlFor="vehicle3">{children}</label>
        </div>
}

const QuickstartCompose = (props: AIOProps) => {
    const {
        data,
        name,
        client = false
    } = props;

    const [composeState, setCompose] = useState({
        stacksFrom: 'dir',
        api: false
    } as ComposeStateData);
    const [userDoc, setUserDoc] = useState(doc);

    const [hostInputValue, setHostInputValue] = React.useState("");
    const [hostValue] = useDebounce(hostInputValue, 500);

    const handleHostInputChange = (event) => {
        setHostInputValue(event.target.value);
    }

    const [serverInputValue, setServerInputValue] = React.useState("");
    const [serverValue] = useDebounce(serverInputValue, 500);

    const handleServerInputChange = (event) => {
        setServerInputValue(event.target.value);
    }

    const [komodoUrlInputValue, setKomodoUrlInputValue] = React.useState("");
    const [komodoUrlValue] = useDebounce(komodoUrlInputValue, 500);

    const handleKomodoUrlInputChange = (event) => {
        setKomodoUrlInputValue(event.target.value);
    }

    const [apiKeyInputValue, setApikeyInputValue] = React.useState("");
    const [apiKeyValue] = useDebounce(apiKeyInputValue, 500);

    const handleApikeyInputChange = (event) => {
        setApikeyInputValue(event.target.value);
    }

    const [apiSecretInputValue, setApiSecretInputValue] = React.useState("");
    const [apiSecretValue] = useDebounce(apiSecretInputValue, 500);

    const handleApiSecretInputChange = (event) => {
        setApiSecretInputValue(event.target.value);
    }

    const komodoApiCallback = useCallback(() => {
        setCompose({...composeState, api: !composeState.api});
    }, [composeState, setCompose]);

    useEffect(() => {

    const modifiedDoc = doc.clone();

    const hostPath = hostValue !== undefined && hostValue.trim() !== '' ? hostValue : '/home/myUser/homelab';
    const hostPathS = new Scalar(`${hostPath}:/filesOnServer`);
    hostPathS.commentBefore = `# ${composeState.stacksFrom === 'dir' ? 'Parent directory where all subfolders are compose projects' : 'Top-most directory that contains all folders (at any level) that compose projects are found in'}`

    modifiedDoc.setIn(['services','komodo-import','volumes', 0], hostPathS);

    modifiedDoc.setIn(['services','komodo-import','environment'], new YAMLSeq());

    const seq = modifiedDoc.getIn(['services','komodo-import','environment']) as YAMLSeq;


    const hostS = new Scalar(`HOST_PARENT_PATH=${hostPath}`);
    hostS.commentBefore = `# Same as mounted directory above`
    seq.add(hostS);

    const stacksFromS = new Scalar(`STACKS_FROM=${composeState.stacksFrom}`);
    stacksFromS.commentBefore = '# Determines what sources to generate Stacks from'
    stacksFromS.comment = `# ${composeState.stacksFrom === 'dir' ? 'Generate stacks from subfolders in directory' : 'Generate stacks from compose projects'}`
    seq.add(stacksFromS);

    const serverS = new Scalar(`SERVER_NAME=${serverValue !== undefined && serverValue.trim() !== '' ? serverValue : 'my-cool-server'}`);
    serverS.commentBefore = '# Name of Server for this machine, in Komodo'
    seq.add(serverS);
    
    if(composeState.api) {
        const urlS = new Scalar(`KOMODO_URL=${komodoUrlValue === '' ? 'http://192.168.KOMOMDO.IP:8120' : komodoUrlValue}`);
        urlS.spaceBefore = true;
        urlS.commentBefore = '# Configuration for interacting with Komodo API';
        seq.add(urlS);
        seq.add(`API_KEY=${apiKeyValue === '' ? 'K-3A6btIPZYeBu_EXAMPLE_KEY' : apiKeyValue}`);
        seq.add(`API_SECRET=${apiSecretValue === '' ? 'S-qnaXD1frutYlfC2ZYl_EXAMPLE_SECRET' : apiSecretValue}`);
        const syncS = new Scalar('OUTPUT_API_SYNC=true');
        syncS.comment = 'Create Sync Resource in Komodo'
        seq.add(syncS);
    }

    if(composeState.stacksFrom === 'compose') {
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

    }, [composeState, hostValue, serverValue, apiKeyValue, apiSecretValue, komodoUrlValue, setUserDoc]);



    //const setOptByName = (name: string) => (e: React.ChangeEvent<HTMLInputElement>) => setCompose({...composeState, [name]: e.currentTarget.checked});

    return <Fragment>

        <h3>1. What source to generate Stacks from?</h3>

        <p>
            <ButtonGroup 
        options={[['dir','Directory'], ['compose','Compose Projects']]} 
        defaultValue="dir" 
        value={composeState.stacksFrom} 
        variant="primary"
        size="lg"
        onChange={(val) => setCompose({...composeState, stacksFrom: val as ('compose' | 'dir')})}
        />
        </p>

        <span style={{display: composeState.stacksFrom === 'dir' ? 'inherit' : 'none'}}>
            <Admonition type="info">
                For <strong>Directory</strong> (<CodeInline>STACKS_FROM=dir</CodeInline>) Komodo Import will try to generate Stacks from each <strong>subfolder</strong> inside the directory mounted into the container.
            </Admonition>
        </span>
        <span style={{display: composeState.stacksFrom === 'compose' ? 'inherit' : 'none'}}>
            <Admonition type="info">
                For <strong>Compose Projects</strong> (<CodeInline>STACKS_FROM=compose</CodeInline>) Komodo Import will try to generate Stacks from existing projects on your machine that were created with <CodeInline>docker compose up</CodeInline>
            </Admonition>
        </span>

        <h3>2. Where are your existing projects located on your machine?</h3>

        <p>
            <label className="margin-right--sm" htmlFor="hostDir"><strong>Host Directory:</strong></label>
            <input id="hostDir" type="text" placeholder="/home/myUser/homelab" onChange={handleHostInputChange} value={hostInputValue}/>
        </p>

        {composeState.stacksFrom === 'compose' ? <MDXContent><HostComposeSnippet/></MDXContent> : <MDXContent><HostSnippet/></MDXContent>}

        <h3>3. What is the name of this Komodo Server?</h3>

        <p>Once Komodo Periphery agent was added to this machine you connected it to Komodo as a <a href="https://komo.do/docs/resources#server"><strong>Server</strong></a>. Specify the name you gave it.</p>

        <p>
            <label className="margin-right--sm" htmlFor="serverName"><strong>Server Name:</strong></label>
            <input id="serverName" type="text" placeholder="my-cool-server" onChange={handleServerInputChange} value={serverInputValue}/>
        </p>

        <h3>4. Where should generated Stacks be created?</h3>

        <p><Button className="margin-right--md" label="Console" link="#" variant="primary" disabled/> <Button label="Komodo" link="#" variant="primary" 
        outline={!composeState.api}
        onClick={komodoApiCallback}/></p>

        <p>Generated Stacks are <strong>always</strong> output to docker logs as a <a href="../usage/resourceSync/#create-sync-resource">Sync Resource</a>.</p>

        <MDXContent><ConsoleOutput/></MDXContent>

        <div style={{display: composeState.api ? 'inherit' : 'none'}}>
            <p>Komodo Import can, additionally, create a <a href="../usage/resourceSync/#create-sync-resource">Sync Resource</a> with the generated Stacks in Komodo for you. This method <strong>only</strong> creates the Resource, it does not execute or change your existing Stacks.</p>

            <p>Create an <a href="../usage/overview#api-sync">API Key and Secret</a>, then specify them below.</p>
            <p>
                <label className="margin-right--sm" htmlFor="url"><strong>Komodo URL:</strong></label>
                <input id="url" type="text" placeholder="http://192.168.0.101:8120" onChange={handleKomodoUrlInputChange} value={komodoUrlInputValue}/>
            </p>
            <p>
                <label className="margin-right--sm" htmlFor="apiKey"><strong>Komodo API Key:</strong></label>
                <input id="apiKey" type="text" placeholder="K-3A6btIPZYeBuD5ebSa9uD5ebuD5ebHIjYxT5sc" onChange={handleApikeyInputChange} value={apiKeyInputValue}/>
            </p>
            <p>
                <label className="margin-right--sm" htmlFor="apiSecret"><strong>Komodo API Secret:</strong></label>
                <input id="apiSecret" type="text" placeholder="S-qnaXD1frutYlfC2ZYlfCSzqiYlfC1WYlfCVR34Yj4" onChange={handleApiSecretInputChange} value={apiSecretInputValue}/>
            </p>
            <MDXContent><ApiOutput/></MDXContent>
        </div>

        <h3>5. Save your customized Compose file</h3>

        <p>The file below has been customized for your specific machine! Save this somewhere on the machine:</p>
        
        {/* <Checkbox id="autoUpdate" checked={composeState.autoUpdate} onChange={setOptByName('autoUpdate')}>Auto Update</Checkbox>
        <Checkbox id="pollUpdate" checked={composeState.pollUpdate} onChange={setOptByName('pollUpdate')}>Poll For Update?</Checkbox> */}
        <CodeBlock title="compose.yaml" language="yaml">{userDoc.toString()}</CodeBlock>
        </Fragment>;
}

const WrappedQuickstartCompose = (props: AIOProps) => {
    return <ErrorBoundary
        fallback={({error}) => (
            <div>
            <Admonition type="danger">
                <p>Interactive Quickstart crashed because of error! Sorry.</p>
                <CodeBlock>{error.stack}</CodeBlock>
            </Admonition>
            </div>
        )}
    ><QuickstartCompose {...props} /></ErrorBoundary>
}


export default WrappedQuickstartCompose;
