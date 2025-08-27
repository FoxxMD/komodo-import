import React, {type ReactNode} from 'react';
import DocItem from '@theme-original/DocItem';
import type DocItemType from '@theme/DocItem';
import type {WrapperProps} from '@docusaurus/types';
import DocsRating from '@site/src/components/DocsRating';

type Props = WrapperProps<typeof DocItemType>;

export default function DocItemWrapper(props: Props): ReactNode {
  return (
    <>
      <DocItem {...props} />
      <div className="row">
        <div className="col col--9" style={{justifyContent: 'center', display: 'flex'}}>
      <DocsRating label="fdsfd"/>
      </div>
      </div>
    </>
  );
}
