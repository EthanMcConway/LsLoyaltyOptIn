// ==UserScript==
// @name         Opt-in Status loyalty
// @namespace    http://tampermonkey.net/
// @version      1.0
// @author       Etooooo
// @description  Show opt-in status for email/SMS marketing on  LSLoyalty
// @match        https://loyalty.lightspeedapp.com/user_list
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let table = null;
    let observer;
    let customerDataCache = null;
    let debounceTimer;

    async function fetchCustomerData() {
        const response = await fetch('https://loyalty.lightspeedapp.com/api/customers/?&data%5BmerchantID%5D=3149&data%5Bcolumns%5D%5B%5D=UserName&data%5Bcolumns%5D%5B%5D=PhoneNumber&data%5Bcolumns%5D%5B%5D=FirstName&data%5Bcolumns%5D%5B%5D=LastName&data%5Bcolumns%5D%5B%5D=AccountCreatedDateTime&data%5Bcolumns%5D%5B%5D=HasOptedInForEmail&data%5Bcolumns%5D%5B%5D=HasOptedInForPhone&data%5Bcolumns%5D%5B%5D=Points&format=csv');
        const csvText = await response.text();
        return parseCSV(csvText);
    }

    function parseCSV(csvText) {
        const [headers, ...rows] = csvText.trim().split('\n').map(row => row.split(','));
        return rows.map(row => Object.fromEntries(headers.map((header, index) => [header.trim(), row[index].replace(/"/g, '').trim()])));
    }

    function normalizePhoneNumber(phoneNumber) {
    let normalized = phoneNumber.replace(/\D/g, '');
    if (normalized.startsWith("44") && normalized.length > 10 && normalized.charAt(2) !== '0') {
        normalized = `440${normalized.slice(2)}`;
    }
    return normalized;
}

    function insertOptInColumns() {
        const headerRow = table.querySelector('thead tr');
        if (!headerRow.querySelector('.email-opt-in')) {
            headerRow.insertAdjacentHTML('beforeend', '<th class="email-opt-in">Email Opt-In</th>');
        }
        if (!headerRow.querySelector('.sms-opt-in')) {
            headerRow.insertAdjacentHTML('beforeend', '<th class="sms-opt-in">SMS Opt-In</th>');
        }
    }

    function updateOptInData(customers) {
        table.querySelectorAll('tbody tr').forEach(row => {
            const phoneCell = row.cells[1];
            if (!phoneCell) return;

            const phoneNumber = phoneCell.textContent.trim();
            const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
            const customer = customers.find(c => normalizePhoneNumber(c.PhoneNumber) === normalizedPhoneNumber);

            let emailOptInCell = row.querySelector('.email-opt-in-cell');
            let smsOptInCell = row.querySelector('.sms-opt-in-cell');

            if (!emailOptInCell) {
                emailOptInCell = document.createElement('td');
                emailOptInCell.classList.add('email-opt-in-cell');
                row.appendChild(emailOptInCell);
            }

            if (!smsOptInCell) {
                smsOptInCell = document.createElement('td');
                smsOptInCell.classList.add('sms-opt-in-cell');
                row.appendChild(smsOptInCell);
            }

            if (customer) {
                emailOptInCell.textContent = customer.HasOptedInForEmail === 'Yes' ? 'Yes' : 'No';
                smsOptInCell.textContent = customer.HasOptedInForPhone === 'Yes' ? 'Yes' : 'No';
            } else {
                emailOptInCell.textContent = 'N/A';
                smsOptInCell.textContent = 'N/A';
            }
        });
    }

    function setupObserver(customers) {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => updateOptInData(customers), 100);
        });

        observer.observe(table.querySelector('tbody'), { childList: true, subtree: true });
    }

    async function main() {
        const observerConfig = { childList: true, subtree: true };

        new MutationObserver(async (mutationsList, observer) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    table = document.querySelector('#example');
                    if (table) {
                        if (!customerDataCache) {
                            customerDataCache = await fetchCustomerData();
                        }
                        insertOptInColumns();
                        updateOptInData(customerDataCache);
                        setupObserver(customerDataCache);
                    }
                }
            }
        }).observe(document.body, observerConfig);
    }

    main();
})();