# Privacy Containers

**Give every browser identity its own route, rules, and working context.**

Privacy Containers is a Firefox extension for security testing with Firefox
Containers. It turns a browser full of overlapping sessions into a workspace
you can reason about: a client container through one proxy, a test account
through another, and your everyday browsing left alone.

No more wondering which tab is using which route.

## One browser, clearly separated contexts

Create or reuse Firefox containers, then give each one the behaviour it needs.
A container can take a direct route or use a reusable HTTP, HTTPS, SOCKS5, or
SOCKS4 proxy. Add its own request headers, give it a distinct PwnFox color when
needed, and keep the setup available from a single configuration page.

```
Container  →  Proxy route  →  Request headers  →  Host rules
```

The result is practical isolation for the work that matters: authenticated
testing, multi-account workflows, local development, and proxy-based analysis.

## Built for the testing flow

**Route with intent.** Define a proxy once and assign it to any container.
SOCKS5 remote DNS, HTTP/HTTPS proxy authentication, localhost bypasses, and
per-proxy exceptions are there when a real environment needs them.

**Make each request identifiable.** Add custome headers globally or per container.
Enable the PwnFox-compatible `X-PwnFox-Color` header to keep your traffic easy
to recognise in supporting tools.

**Control where a container can go.** Host Rules let you block a host or allow
it only from selected containers. When navigation is stopped, the extension
shows a clear blocked page and can offer an allowed container for reopening it.

**Stay in the keyboard flow.** Open or reopen a tab in a container, move through
tabs, and pin or unpin the current tab with configurable shortcuts. Container
slots follow Firefox’s live container order.

## Small actions, immediate payoff

The toolbar popup is intentionally compact. On the current web page it can:

- restore paste or text selection when a page blocks it;
- enable disabled inputs;
- clear the page’s local storage, session storage, or cookies.

Each action is explicit, targets the active HTTP(S) tab only, and reports its
result in place.

## Get useful in three steps

1. Open **Containers & proxies config** from the toolbar popup.
2. Create a proxy and assign it to a Firefox container.
3. Open a tab in that container and work with a route you can identify.

From there, add headers, shortcuts, or Host Rules only when the workflow calls
for them.

## A transparent power-user extension

Privacy Containers needs broad Firefox permissions because routing requests,
managing container tabs, injecting user-requested page actions, and clearing
cookies are its core features. Its configuration is stored locally in Firefox;
it has no account, cloud service, or remotely loaded code.

The extension does no data collection nor transmission. If you configure a proxy,
the traffic in the assigned container is of course sent through that proxy under
your control.

## Compatibility and license

Designed for desktop Firefox 140 and later, with Firefox Containers enabled.

Released under the [Mozilla Public License 2.0](LICENSE).
