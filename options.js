function buildList(items) {
    const list = document.getElementsByTagName("ul")[0]
    list.innerHTML = ''
    for (let i = 0; i < items.length; ++i) {
        const item = document.createElement('li')
        item.innerHTML = items[i].url
        if (items[i].rule) {
            const innerItem = document.createElement('li')
            innerItem.innerHTML = items[i].rule

            const innerList = document.createElement('ul')
            innerList.appendChild(innerItem)

            item.style.color = "red"
            item.appendChild(innerList)
        } else {
            item.style.color = "green"
        }

        list.appendChild(item)
    }
}

function loadLogs() {
    let items = [];
    chrome.storage.local.get(null, function (logs) {
        items.length = 0
        Object.keys(logs).sort().reduce(
            (arr, key) => {
                arr.push({key, ...logs[key]});
                return arr;
            },
            items
        )

        buildList(items)
    })

    chrome.storage.onChanged.addListener(function (changes, namespace) {
        for (let key in changes) {
            items.push({key, ...changes[key].newValue})
        }

        items.sort(function (a, b) {
            if (a.key > b.key) return 1
            if (a.key === b.key) return 0
            return -1
        })

        buildList(items)
    });
}

document.addEventListener('DOMContentLoaded', loadLogs)
