# Analytics

The chrome provides a Segment analytics  that modules can use to customize and track user events. Before you start using the API, please read more about the <a href="https://segment.com/docs/connections/sources/catalog/libraries/website/javascript/#basic-tracking-methods" target="_blank">Segment tracking.</a>

## Customizing default page event

*<a href="https://segment.com/docs/connections/sources/catalog/libraries/website/javascript/#page" target="_blank">The page event</a> is automatically called on each browser URL change.*

> The initial page event is triggered before the module is fully initialized. Additional events can be triggered at runtime at any time.

### Access the page event setter through chrome

```jsx
import useChrome from '@redhat-cloud-services/frontend-components/useChrome';

...

const { segment: { setPageMetadata } } = useChrome();
``` 

### Set additional page event data

```jsx

useEffect(() => {
  /**
   * Set custom metadata for segment analytics page event
   * Data can be updated anytime during the runtime
   */
  setPageMetadata({
    customPropertyOne: true,
    customPropertyTwo: 'John Doe',
    customDynamicProperty: history.location.pathname,
  });
}, [history.location.pathname]);

```

### Default page event data sample

```json
  "anonymousId": "a4b53248-c0ab-411d-bfba-625de10eac1b",
  "context": {
    "campaign": {},
    "groupId": "11789772",
    "ip": "66.187.232.127",
    "library": {
      "name": "analytics.js",
      "version": "npm:next-1.38.0"
    },
    "locale": "en-US",
    "page": {
      "path": "/insights/vulnerability/cves",
      "referrer": "",
      "search": "?affecting=true&page=1&page_size=20&sort=-cvss_score",
      "title": "CVEs - Vulnerability | Red Hat Insights",
      "url": "https://gov.console.stage.redhat.com/insights/vulnerability/cves?affecting=true&page=1&page_size=20&sort=-cvss_score"
    },
    "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.54 Safari/537.36"
  },
  "integrations": {},
  "messageId": "ajs-next-4052c0f68ba89b1cf7805543de3c0cfe",
  "originalTimestamp": "2022-07-07T09:05:07.998Z",
  "properties": {
    "isBeta": true,
    "module": "vulnerability",
    "path": "/insights/vulnerability/cves",
    "referrer": "",
    "search": "?affecting=true&page=1&page_size=20&sort=-cvss_score",
    "title": "CVEs - Vulnerability | Red Hat Insights",
    "url": "https://gov.console.stage.redhat.com/insights/vulnerability/cves?affecting=true&page=1&page_size=20&sort=-cvss_score"
  },
  "receivedAt": "2022-07-07T09:05:08.032Z",
  "sentAt": "2022-07-07T09:05:07.998Z",
  "timestamp": "2022-07-07T09:05:08.032Z",
  "type": "page",
  "userId": "51834776"
```

## Custom event tracking

Chrome API also exposes the full `analytics` instance to allow custom event tracking.

Checkout the <a href="https://github.com/RedHatInsights/insights-rbac-ui/pull/1188" target="_blank">RBAC UI example.</a>

### Example: tracking user click event

```jsx
import useChrome from '@redhat-cloud-services/frontend-components/useChrome';

...

const RemoveEntityButton = ({ entityId, handleRemove }) => {
  const { analytics } = useChrome();

  return (
    <div>
      <button onClick={() => {
        analytics.track('remove-entity', {
          entityId
        });
        handleRemove()
      }}>Remove entity: {entityId}</button>
    </div>
  )
}

```

## Creating custom UI module segment

*By default, UI modules share the `Hybrid Cloud Console Dev` and `Hybrid Cloud Console` segments.*

The segment analytics allows defining multiple sources/namespaces to separate (segment) analytics data. To create a new source for a module, it is necessary to provide a unique API key. It can be existing key or new key.

### Get unique API key

1. Go to the <a href="https://app.segment.com/redhat-devtools/sources" target="_blank">sources dahboard</a>.
2. If required, create new source using the "Add Source" button on the top right.
3. Go to desired source and click on the overview tab.
4. Expand the *"Add Segment to your site - required"* section.
5. Copy the API key from the `analytics.load()` function call in the expanded JS snippet: 
```js
<script>
  !function(){var analytics=window.analytics=window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var key=analytics.methods[e];analytics[key]=analytics.factory(key)}analytics.load=function(key,e){var t=document.createElement("script");t.type="text/javascript";t.async=!0;t.src="https://cdn.segment.com/analytics.js/v1/" + key + "/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(t,n);analytics._loadOptions=e};analytics._writeKey="your-key-will-be-here";;analytics.SNIPPET_VERSION="4.15.3";
  analytics.load("your-key-will-be-here");
  analytics.page();
  }}();
</script>

```

### Configure UI module to use unique API key

The segment analytics key configuration is stored in the cloud-services-config module configuration file.

*This configuration is moved to the UI repository in the new frontend operator!*

1. Open the UI module definition file `fed-module.json` (or the operator equivalent).
2. Add a new property to the required module:

```diff
diff --git a/chrome/fed-modules.json b/chrome/fed-modules.json
index 654ef7a..7fd1b30 100644
--- a/chrome/fed-modules.json
+++ b/chrome/fed-modules.json
@@ -38,6 +38,9 @@
     "rbac": {
         "manifestLocation": "/apps/rbac/fed-mods.json",
         "isFedramp": true,
+        "analytics": {
+            "APIKey": "foo-bar"
+        },
         "modules": [
             {
                 "id": "my-user-access",

```

*You can have different segments for different environments*.
