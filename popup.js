"use strict"

const port = chrome.extension.connect()
const list = document.getElementsByTagName("ul")[0]
const span = document.getElementsByTagName("span")[0]

port.onMessage.addListener(function (payload) {
    if (payload.type === "ALL") {
        span.style.display = "none"
        list.style.display = "block"
        const blocked = payload.blocked.sort()
        for (let i = 0; i < blocked.length; ++i) {
            const item = document.createElement('li')
            item.innerHTML = blocked[i]
            list.appendChild(item)
        }
    } else {
        const item = document.createElement('li')
        item.innerHTML = payload.blocked
        list.appendChild(item)
    }
});
