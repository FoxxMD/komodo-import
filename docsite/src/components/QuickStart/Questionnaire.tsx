import React, { Fragment, PropsWithChildren, useCallback } from "react"
import CodeBlock from '@theme/CodeBlock';
import CodeInline from '@theme/CodeInline';
import Admonition from '@theme/Admonition';
import MDXContent from "@theme/MDXContent";
import ErrorBoundary from "@docusaurus/ErrorBoundary"
import Button from '../Button';
import ButtonGroup from '../ButtonGroup';
import { useDebounce } from "use-debounce";
import HostComposeSnippet from './snippets/hostDirCompose.mdx';
import HostSnippet from './snippets/hostDir.mdx';
import ConsoleOutput from './snippets/consoleOutput.mdx';
import ApiOutput from './snippets/apiOutput.mdx';
import QSCompose from './QSCompose';
import { useTypedLocalStorage } from "../useLocalStorage";
import { HostDirectory, ServerName, KomodoUrl, KomodoApiKey, KomodoApiSecret } from '../LocalStorageComponents';

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

    // cannot remove at least one referece to useDebounce or else docusarus panics with
    // message: should mgm exist
    // https://github.com/web-infra-dev/rspack/pull/11204
    // maybe need to wait for docusarus to update rspack?
    const [dummy, setDummy] = useDebounce("", 1000);

    const [storageStacksFromVal, setStorageStacksFromVal] = useTypedLocalStorage('docusaurus.tab.stacksFrom', 'dir', false);
    const [storageSyncApiVal, setStorageSyncApiVal] = useTypedLocalStorage('syncApi', false);

    const komodoApiCallback = useCallback(() => {
        setStorageSyncApiVal(!storageSyncApiVal);
    }, [storageSyncApiVal,setStorageSyncApiVal]);

    const stacksFromCallback = useCallback((val) => {
        setStorageStacksFromVal(val);

    }, [setStorageStacksFromVal]);

    //const setOptByName = (name: string) => (e: React.ChangeEvent<HTMLInputElement>) => setCompose({...composeState, [name]: e.currentTarget.checked});

    return <Fragment>

        <h3>1. What <a href="../usage/overview#stack-sources">Stack Sources</a> to generate Stacks from?</h3>

        <p>
            <ButtonGroup 
        options={[['dir','Directory'], ['compose','Compose Projects']]} 
        defaultValue="dir" 
        value={storageStacksFromVal} 
        variant="primary"
        size="lg"
        onChange={(val) => stacksFromCallback(val)}
        />
        </p>

        <span style={{display: storageStacksFromVal === 'dir' ? 'inherit' : 'none'}}>
            <Admonition type="info">
                For <strong>Directory</strong> (<CodeInline>STACKS_FROM=dir</CodeInline>) Komodo Import will try to generate Stacks from each <strong>subfolder</strong> inside the directory mounted into the container.
            </Admonition>
        </span>
        <span style={{display: storageStacksFromVal === 'compose' ? 'inherit' : 'none'}}>
            <Admonition type="info">
                For <strong>Compose Projects</strong> (<CodeInline>STACKS_FROM=compose</CodeInline>) Komodo Import will try to generate Stacks from existing projects on your machine that were created with <CodeInline>docker compose up</CodeInline>
            </Admonition>
        </span>

        <h3>2. Where are your existing projects located on your machine?</h3>

        <p>
            <label className="margin-right--sm" htmlFor="hostDir"><strong><a href="../usage/overview#host-directory">Host Directory:</a></strong></label>
            <HostDirectory/>
        </p>

        {storageStacksFromVal === 'compose' ? <MDXContent><HostComposeSnippet/></MDXContent> : <MDXContent><HostSnippet/></MDXContent>}

        <h3>3. What is the name of this Komodo Server?</h3>

        <p>Once Komodo Periphery agent was added to this machine you connected it to Komodo as a <a href="https://komo.do/docs/resources#server"><strong>Server</strong></a>. Specify the name you gave it.</p>

        <p>
            <label className="margin-right--sm" htmlFor="serverName"><strong>Server Name:</strong></label>
            <ServerName/>
        </p>

        <h3>4. Where should generated Stacks be created?</h3>

        <p>Choose one or more <a href="../usage/overview#outputs-1">Outputs</a>:</p>

        <p><Button className="margin-right--md" label="Console" link="#" variant="primary" disabled/>
        <Button label="Komodo" link="#" variant="primary" 
        outline={!storageSyncApiVal}
        onClick={komodoApiCallback}/></p>

        <div style={{display: storageSyncApiVal ? 'inherit' : 'none'}}>
            <p>Komodo Import can create a <a href="../usage/resourceSync#create-sync-resource">Sync Resource</a> with the generated Stacks in Komodo for you. This method <strong>only</strong> creates the Resource, it does not execute or change your existing Stacks.</p>

            <p>Create an <a href="../usage/overview#api-sync">API Key and Secret</a>, then specify them below.</p>
            <p>
                <label className="margin-right--sm" htmlFor="url"><strong>Komodo URL:</strong></label>
                <KomodoUrl/>
            </p>
            <p>
                <label className="margin-right--sm" htmlFor="apiKey"><strong>Komodo API Key:</strong></label>
                
                <KomodoApiKey/>
            </p>
            <p>
                <label className="margin-right--sm" htmlFor="apiSecret"><strong>Komodo API Secret:</strong></label>
                {/* <input id="apiSecret" type="text" placeholder="S-qnaXD1frutYlfC2ZYlfCSzqiYlfC1WYlfCVR34Yj4" onChange={handleApiSecretInputChange} value={apiSecretInputValue}/> */}
                <KomodoApiSecret/>
            </p>
            <MDXContent><ApiOutput/></MDXContent>
        </div>

        <p>Generated Stacks are <strong>always</strong> output to docker logs as a <a href="../usage/resourceSync#create-sync-resource">Sync Resource</a>.</p>

        <MDXContent><ConsoleOutput/></MDXContent>

        <h3>5. Save your customized Compose file</h3>

        <p>The file below has been customized for your specific machine! Save this somewhere on the machine:</p>
        
        {/* <Checkbox id="autoUpdate" checked={composeState.autoUpdate} onChange={setOptByName('autoUpdate')}>Auto Update</Checkbox>
        <Checkbox id="pollUpdate" checked={composeState.pollUpdate} onChange={setOptByName('pollUpdate')}>Poll For Update?</Checkbox> */}
        <QSCompose/>
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
