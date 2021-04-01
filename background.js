"use strict"

chrome.contextMenus.create({
    title: "logs",
    contexts: ["browser_action"],
    onclick: function () {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('options.html'));
        }
    }
});

chrome.webRequest.onBeforeRequest.addListener(
    filter,
    {urls: ["<all_urls>"]},
    ["blocking"]
)

let rules = [
    "com^analytics.js^",
    "quantserve.com^quant.js|",
    "||overflow.com^",
    "net^Js/full-anon.en.j"
]

// manage tabs
let currentTabId = null
chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
    if (tabs && tabs.length > 0) {
        currentTabId = tabs[0].id
    }
})

chrome.tabs.onActivated.addListener(function (tab) {
    currentTabId = tab.tabId
})

chrome.tabs.onRemoved.addListener(function (tabId) {
    const blocked = blockedByTab[tabId]
    if (blocked) {
        blocked.clear()
    }
})
//

const blockedByTab = {}
let connection = null

chrome.extension.onConnect.addListener(function (port) {
    connection = port
    if (currentTabId !== undefined && currentTabId !== null) {
        const blocked = blockedByTab[currentTabId]
        if (blocked && blocked.size > 0) {
            port.postMessage({type: "ALL", blocked: Array.from(blocked)})
        }
    }

    port.onDisconnect.addListener(function () {
        connection = null
    })
})

function log(url, rule) {
    const item = {}
    const key = Date.now()
    item[key] = {url, rule}
    chrome.storage.local.set(item);
}

function postAdd(details) {
    connection && details.tabId === currentTabId && connection.postMessage({type: "ADD", blocked: details.url})
}

function filter(details) {
    for (const rule of rules) {
        if (checkRule(details.url, rule)) {
            log(details.url, rule)
            const blocked = blockedByTab[details.tabId]
            if (blocked === undefined) {
                blockedByTab[details.tabId] = new Set([details.url])
                postAdd(details)
            } else {
                if (!blocked.has(details.url)) {
                    postAdd(details)
                    blocked.add(details.url)
                }
            }

            return {cancel: true}
        }
    }
    log(details.url, null)

    return {cancel: false}
}

function checkRule(input, rule) {
    const result = modifyRule(rule)
    const match = input.match(result.rule)
    if (match == null) {
        return false
    }

    const url = new URL(input)
    const hostStart = input.indexOf(url.hostname)
    const hostEnd = hostStart + url.hostname.length

    const matchStart = input.indexOf(match[1])

    return matchStart >= hostStart && matchStart < hostEnd
}

function modifyRule(rule) {
    const result = {rule: '', checkDomain: false}
    let start = 0
    if (rule.charAt(0) === '|') {
        if (rule.charAt(1) === '|') {
            start = 2
            result.rule += '.*?('
            result.checkDomain = true
        } else {
            start = 1
            result.rule += '^'
        }
    } else {
        result.rule += '.*'
    }

    let i
    for (i = start; i < rule.length - 1; ++i) {
        let ch = rule.charAt(i)
        if (ch === '^') {
            result.rule += "[/:?]"
        } else if (ch === '*') {
            result.rule += '.*'
        } else {
            result.rule += ch
        }
    }

    const last = rule.charAt(i)
    if (last === '|') {
        result.rule += '$'
    } else if (last === '^') {
        result.rule += "([/:\?].*|$)"
    } else {
        result.rule += last + '.*'
    }

    if (result.checkDomain) {
        result.rule += ')'
    }

    return result
}
