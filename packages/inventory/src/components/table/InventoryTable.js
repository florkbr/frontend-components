/* eslint-disable camelcase */
import React, { Fragment, forwardRef, useEffect, useRef } from 'react';
import { useSelector, shallowEqual, useStore, useDispatch } from 'react-redux';
import EntityTableToolbar from './EntityTableToolbar';
import { TableToolbar } from '@redhat-cloud-services/frontend-components/TableToolbar';
import { ErrorState } from '@redhat-cloud-services/frontend-components/ErrorState';
import InventoryList from './InventoryList';
import Pagination from './Pagination';
import AccessDenied from '../../shared/AccessDenied';
import { loadSystems } from '../../shared';
import isEqual from 'lodash/isEqual';

/**
 * A helper function to store props and to always return the latest state.
 * For example, EntityTableToolbar wraps OnRefreshData in a callback, so we need this
 * to get the latest props and not the props at the time of when the function is
 * being wrapped in callback.
 */
const propsCache = () => {
    let cache = {};

    const updateProps = (props) => { cache = props; };

    const getProps = () => cache;

    return { updateProps, getProps };
};

/**
 * This component is used to combine all essential components together:
 *   * EntityTableToolbar - to control top toolbar.
 *   * InventoryList - to allow consumers to change data from outside and contains actual inventory table.
 *   * Pagination - bottom pagination.
 * It also calculates pagination and sortBy from props or from store if consumer passed items or not.
 */
const InventoryTable = forwardRef(({
    onRefresh,
    children,
    inventoryRef,
    items,
    total: propsTotal,
    page: propsPage,
    perPage: propsPerPage,
    filters,
    showTags,
    sortBy: propsSortBy,
    customFilters,
    hasAccess = true,
    isFullView = false,
    getEntities,
    hideFilters,
    paginationProps,
    errorState = <ErrorState />,
    autoRefresh,
    ...props
}, ref) => {
    const hasItems = Boolean(items);
    const error = useSelector(({ entities }) => (
        entities?.error
    ));
    const page = useSelector(({ entities: { page: invPage } }) => (
        hasItems ? propsPage : (invPage || 1)
    )
    , shallowEqual);
    const perPage = useSelector(({ entities: { perPage: invPerPage } }) => (
        hasItems ? propsPerPage : (invPerPage || 50)
    )
    , shallowEqual);
    const total = useSelector(({ entities: { total: invTotal } }) => {
        if (hasItems) {
            return propsTotal !== undefined ? propsTotal : items?.length;
        }

        return invTotal;
    }, shallowEqual);
    const pagination = {
        page,
        perPage,
        total
    };
    const sortBy = useSelector(({ entities: { sortBy: invSortBy } }) => (
        hasItems ? propsSortBy : invSortBy
    ), shallowEqual);

    const dispatch = useDispatch();
    const store = useStore();

    const cache = useRef(propsCache());
    cache.current.updateProps({
        page,
        perPage,
        items,
        sortBy,
        hideFilters,
        showTags,
        getEntities,
        customFilters
    });

    /**
     * If consumer wants to change data they can call this function via component ref.
     * @param {*} options new options to be applied, like pagination, filters, etc.
     */
    const onRefreshData = (options = {}, disableOnRefresh) => {
        const { activeFilters } = store.getState().entities;
        const cachedProps = cache.current?.getProps() || {};

        // eslint-disable-next-line camelcase
        const currPerPage = options?.per_page || options?.perPage || cachedProps.perPage;

        const params = {
            page: cachedProps.page,
            per_page: currPerPage,
            items: cachedProps.items,
            sortBy: cachedProps.sortBy,
            hideFilters: cachedProps.hideFilters,
            filters: activeFilters,
            ...cachedProps.customFilters,
            ...options
        };

        if (onRefresh && !disableOnRefresh) {
            onRefresh(params, (options) => {
                dispatch(
                    loadSystems(
                        { ...params, ...options },
                        cachedProps.showTags,
                        cachedProps.getEntities
                    )
                );
            });
        } else {
            dispatch(
                loadSystems(
                    params,
                    cachedProps.showTags,
                    cachedProps.getEntities
                )
            );
        }
    };

    const prevFilters = useRef(customFilters);
    useEffect(() => {
        if (autoRefresh && !isEqual(prevFilters.current, customFilters)) {
            onRefreshData();
            prevFilters.current = customFilters;
        }
    });

    return (
        (hasAccess === false && isFullView) ?
            <AccessDenied
                title="This application requires Inventory permissions"
                description={<div>
                    To view the content of this page, you must be granted a minimum of inventory permissions from your Organization Administrator.
                </div>}
            /> :
            !error ? <Fragment>
                <EntityTableToolbar
                    { ...props }
                    customFilters={customFilters}
                    hasAccess={hasAccess}
                    items={ items }
                    filters={ filters }
                    hasItems={ hasItems }
                    total={ pagination.total }
                    page={ pagination.page }
                    perPage={ pagination.perPage }
                    showTags={ showTags }
                    onRefreshData={onRefreshData}
                    sortBy={ sortBy }
                    hideFilters={hideFilters}
                    paginationProps={paginationProps}
                >
                    { children }
                </EntityTableToolbar>
                <InventoryList
                    { ...props }
                    customFilters={customFilters}
                    hasAccess={hasAccess}
                    ref={ref}
                    hasItems={ hasItems }
                    items={ items }
                    page={ pagination.page }
                    sortBy={ sortBy }
                    perPage={ pagination.perPage }
                    showTags={ showTags }
                    onRefreshData={onRefreshData}
                />
                <TableToolbar isFooter className="ins-c-inventory__table--toolbar">
                    <Pagination
                        hasAccess={hasAccess}
                        isFull
                        total={ pagination.total }
                        page={ pagination.page }
                        perPage={ pagination.perPage }
                        hasItems={ hasItems }
                        onRefreshData={onRefreshData}
                        paginationProps={paginationProps}
                    />
                </TableToolbar>
            </Fragment> : errorState
    );
});

export default InventoryTable;
