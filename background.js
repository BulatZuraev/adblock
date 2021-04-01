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

let rulesMap = {}

function generateRules() {
    let rules = [
        "com^analytics.js^",
        "quantserve.com^quant.js|",
        "||stackoverflow.com^",
        "net^Js/full-anon.en.j"
    ]

    for (let i = 0; i < rules.length; ++i) {
        saveRule(rules[i])
    }
}

function saveRule(rule) {
    const result = modifyRule(rule)
    const key = buildKey(rule)

    const rules = rulesMap[key]
    const value = {originalRule: rule, modifiedRule: result}
    if (!rules) {
        rulesMap[key] = [value]
    } else {
        rules.push(value)
    }
}

generateRules()

function filter(details) {
    const keys = getKeys(details.url)
    keys.push('')
    for (const key of keys) {
        const rules = rulesMap[key]
        if (rules) {
            for (const rule of rules) {
                if (checkRule(details.url, rule.modifiedRule)) {
                    log(details.url, rule.originalRule)
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
        }
    }

    log(details.url, null)
    return {cancel: false}
}

function checkRule(input, rule) {
    const match = input.match(rule.rule)
    if (match == null) {
        return false
    }

    if (!rule.checkDomain) {
        return true
    }

    const url = new URL(input)
    const hostStart = input.indexOf(url.hostname)
    const hostEnd = hostStart + url.hostname.length

    const matchStart = input.indexOf(match[1])

    return matchStart >= hostStart && matchStart < hostEnd
}

function getKeys(url) {
    return url.split(/[.\/:?&-]/)
        .filter(key => key.length !== 0)
}

function modifyRule(rule) {
    const result = {rule: '', checkDomain: false}
    let start = 0
    if (rule.charAt(0) === '|') {
        if (rule.charAt(1) === '|') {
            start = 2
            result.rule += '.*?[$\/\.]('
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
            result.rule += "[/:\?]"
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

function buildKey(rule) {
    rule = '*' + rule + '*'
    return rule.split(/[|.\/:?&^-]/)
        .filter(key => key.length !== 0 && key.indexOf('*') === -1)
        .reduce((max, key) => key.length > max.length ? key : max, '')
}
