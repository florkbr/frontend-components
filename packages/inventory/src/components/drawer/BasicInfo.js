/* eslint-disable camelcase */
import React from 'react';
import PropTypes from 'prop-types';
import { Split, SplitItem, StackItem, Stack, Title, Chip, ChipGroup } from '@patternfly/react-core';
import { useSelector } from 'react-redux';

const BasicInfo = ({ hideInvLink, showTags }) => {
    const displayName = useSelector(({ entityDetails: { entity } }) => entity?.display_name);
    const systemId = useSelector(({ entityDetails: { entity } }) => entity?.id);
    const tags = useSelector(({ entityDetails: { entity } }) => entity?.tags);
    return <Stack hasGutter>
        <StackItem>
            <Split>
                <SplitItem isFilled>
                    <Title headingLevel="h4" size='xl'>{ displayName }</Title>
                </SplitItem>
                {!hideInvLink && <SplitItem>
                    <a className='ins-c-entity-detail__inv-link' href={`./insights/inventory/${systemId}`}>Open in Inventory</a>
                </SplitItem>}
            </Split>
        </StackItem>
        {
            showTags &&
            <StackItem>
                <Split hasGutter>
                    <SplitItem>
                        Tags:
                    </SplitItem>
                    <SplitItem>
                        <ChipGroup>
                            {tags.map((item, key) => (
                                <Chip key={key}>
                                    {item?.namespace && `${item?.namespace}/`}
                                    {item?.key}
                                    {item?.value && `=${item?.value}`}
                                </Chip>
                            ))}
                        </ChipGroup>
                    </SplitItem>
                </Split>
            </StackItem>
        }
    </Stack>;
};

BasicInfo.propTypes = {
    hideInvLink: PropTypes.bool,
    showTags: PropTypes.bool
};

BasicInfo.defaultProps = {
    hideInvLink: false,
    showTags: false
};

export default BasicInfo;
