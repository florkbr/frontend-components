# Router v6 upgrade

The router package [react-router-dom](https://reactrouter.com/en/main) has undergone a lot of changes in it latest v6 major release. Frontend applications in HCC are on a v5 which is no longer the LTS. Migration to V6 comes with some challenges. Mainly a router context can no longer be nested.

This means our applications have to adapt to the new changes.

## What are immediate actions?


> NOTE: The chrome UI has to be prepared first. Any application will have to adjust to chrome changes as well.

### My application has marked react-router-dom dependency as singleton

If your application is on v5.x.x and has the router dependency marked as singleton, it will break once we upgrade chrome to v6. Please make sure this is not the case. This can only happen if you are using custom config, or have explicitly set the router dependency as shaped in your config.

Let us (**@crc-experience-team** [#forum-consoledot-ui](https://app.slack.com/client/T027F3GAJ)) so we can keep track of your application.

### My application is already using react-router-dom dependency v6

Please make sure to contact the **@crc-experience-team** [#forum-consoledot-ui](https://app.slack.com/client/T027F3GAJ/C023VGW21NU). The releases must be synchronized.

## BrowserRouter nesting

Currently, both Chrome and applications define their own `BrowserRouter` context. Because the whole UI shares a single VirtualDOM, these components are nested in each other. Chrome is always the top-level context.

```jsx
// react-router-dom@5
// Chrome browser router
<BrowserRouter>
...
  {/**  application specific browser router */}
  <BrowserRouter>
     ...
  </BrowserRouter>
...
</BrowserRouter>
```

This has one major drawback. Chrome and applications do not share the same `browser history` instance. That leads to many side effects (especially when using the browser navigation buttons) and blocks client-side navigation between apps without using ChromeAPI.

<br />

**Nesting Routers is no longer possible in react-router-dom@6!**

<br />

**Nesting Routers is no longer possible in react-router-dom@6!**. It is blocked within the library source code and will result in a runtime error! 

```jsx
// react-router-dom@6
// Chrome browser router
<BrowserRouter>
...
  {/**  application specific browser router */}
  <BrowserRouter>
     ...
  </BrowserRouter>
...
</BrowserRouter>

/**
 * Uncaught Error: You cannot render a <Router> inside another <Router>. You should never have more than one in your app.
    at invariant (vendors-node_modules_react-router-dom_index_js.7c3dc582257c856ce836.js:505:20)
    at Router (vendors-node_modules_react-router-dom_iThe chrome UI has to be prepared first. Any application will have to adjust to chrome changes as well.ndex_js.7c3dc582257c856ce836.js:129
*/
```

We have to adapt to this change and make sure only one Router is in the component tree. **Chrome will be providing the router.**

## You are lying! Router nesting works just fine for me!

In [react-router-dom version 6.3.0](https://github.com/remix-run/react-router/releases/tag/v6.3.0) a compatibility layer with react-router-dom@5 was merged directly into the library. Some legacy features started working and the package has improved backward compatibility.


> It is still just a compatibility layer that will be most likely dropped in future version releases. Do not rely on the compatibility layer. Use it as a stepping stone. If you start with the migration, make sure the app does not use any of the legacy features by the migration end.

## Sharing BrowserRouter and history

Sharing BrowserRouter means that Chrome and applications will share the same history instance. The positive is navigating in the HCC UI will now be simpler and have better UX and will allow fixing all navigation issues and removing several cases of technical debt.

The disadvantage is that it comes with additional developer work.

### Links no longer have basename

Let's take a look at a simplified sample `Link` usage component in v5 and v6 in a pseudo sources application:

```jsx
// In router v5
// chrome
<BrowserRouter basename={isBeta() ? '/beta' : ''}>
  ...
  <SourcesApp>
    {/** Sources UI router configuration */}
    <BrowserRouter basename={`/${isBeta() ? 'beta/' : ''}settings/sources`}>
      ...
      {/** Nested route that leads to http://console.redhat.com/settings/sources/some-id */}
      <Link to="/some-id">Source detail</Link>
    </BrowserRouter>
  </SourcesApp>
</BrowserRouter>
```

With router nesting, it is not necessary to include the router basename in links and routes.

But in v6, history and by extension basename will be shared. Basename will always be `/` or `/beta`.

```jsx
// In router v6
// chrome
<BrowserRouter basename={isBeta() ? '/beta' : ''}>
  ...
  <SourcesApp>
    {/** Sources UI router configuration does not exist. It uses the context from chrome */}
    {/** Nested route that leads to http://console.redhat.com/some-id. There is no sources basename!  */}
    <Link to="/some-id">Source detail</Link>
    {/** Nested route that leads to http://console.redhat.com/settings/sources/some-id */}
    <Link to="/settings/sources/some-id">Source detail</Link>
    {/** If relative links are used, link will use current pathname! http://console.redhat.com/settings/sources/some-id */}
    <Link to="some-id">Source detail</Link>
  </SourcesApp>  
</BrowserRouter>
```

<br/>

**Most of links and routes with absolute paths will point to wrong location!**

<br/>

### Routes must have a relative path prop

Route matching and rendering are slightly different in router v6. Your existing *absolute* routes, will not be matched within the `Routes` component.

```jsx
// in router v5
<BrowserRouter basename={isBeta() ? '/beta' : ''}>
  ...
  <SourcesApp>
    {/** Sources UI router configuration */}
    <BrowserRouter basename={`/${isBeta() ? 'beta/' : ''}settings/sources`}>
      <Switch>
        <Route path="/foo" />
        <Route path="/bar" />
        <Route path="*" />
      <Switch>
    </BrowserRouter>
  </SourcesApp>
</BrowserRouter>
```

```jsx
// in router v6
<BrowserRouter basename={isBeta() ? '/beta' : ''}>
  ...
  <SourcesApp>
    <Routes>
      <Route path="foo/*" />
      <Route path="bar/*" />
      <Route path="*" />
    <Routes>
</BrowserRouter>
```

The Router v6 **APPENDS NESTED ROUTES** to the parent route. If a nested route has an absolute path (starting with /) it will not be matched via its parent!

```jsx
const SourcesApp = () => (
  <Routes>
   {/** This nested route will render at this pathname! */}
    <Route path="/settings/sources/foo" />
    {/** This nested route will render at this pathname! It does not match the "/settings/sources". */}
    <Route path="/foo" />
    {/** Foo route is appended and will render. Will create nested route at "/settings/sources/foo" */} 
    <Route path="foo" /> 
  </Routes>
)

const ChromeRouter = () => (
  <BrowserRouter>
    <Routes>
     {/** Sets a "pseudo" basename for nested routes! */}
      <Route path="/settings/sources" element={<SourcesApp />} />
    <Routes>
  </BrowserRouter>
)
```

## No more useHistory

In version 6 the hook `useHistory` is no longer available. There is also no other way of getting the history object. We will provide the object in ChromeAPI.

The navigation methods are replaced by [useNavigate hook](https://reactrouter.com/en/main/upgrading/v5#use-usenavigate-instead-of-usehistory).

## Migration guide

Check out the official [migration guide](https://reactrouter.com/en/main/upgrading/v5#use-usenavigate-instead-of-usehistory) for router specific guide.

### Upgrading to router v6

**Only start router v6 upgrade once the Chrome was updated and changes were deployed to production!**

#### Update your react-router-dom dependency to `6.x.x`

Simply bump the version app `package.json`. If exists, remove `react-router` from your package.json!

#### Mark your react-router-dom dependency as a singleton in the module federation plugin

```js
plugins.push(
 require('@redhat-cloud-services/frontend-components-config/federated-modules')({
   root: resolve(__dirname, '../'),
   shared: [
     {
       'react-router-dom': { singleton: true, requiredVersion: '*' },
     },
   ],
 })
);

```

#### Remove Router (BrowserRouter)

In your application root (Usually AppEntry.js) remove your Router component.


#### Follow the official migration guide

The rest is now a regular router migration. Check out the official [migration guide](https://reactrouter.com/en/main/upgrading/v5#use-usenavigate-instead-of-usehistory) for router specific guide.
