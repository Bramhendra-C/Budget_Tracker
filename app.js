/**
 * All JavaScript logic for the Personal Budget Tracker application.
 * Note: Since this is a browser-side application using local storage,
 * all global variables and functions previously defined in the script
 * tags must be included here and, where necessary, explicitly exposed
 * to the global scope (window) for HTML inline event handlers (like onclick).
 */

// --- GLOBAL SETUP & LOCAL STORAGE INIT ---

let transactions = [];
// Structure: { category: { period: amount, period: amount, ... } }
let budgets = {}; 
// Structure: [{ id, description, amount, type, category, frequency, day, lastGeneratedTimestamp }]
let recurringTransactions = [];
// NEW: Savings Goals Structure
// [{ id, name, targetAmount, currentAmount, targetDate, createdAt }]
let goals = []; 

let trendChart, breakdownChart, incomeChart; // Global Chart.js instances
let aggregatedData = null; // Global variable to store aggregated data
let currentPeriod = 'month'; // Default period for analytics
let currentBudgetPeriod = 'Monthly'; // Default period for budget settings

// Key for storing data in the browser's local storage
const STORAGE_KEY = 'budgetTrackerTransactions'; 
const STORAGE_KEY_BUDGETS = 'budgetTrackerBudgets'; // Updated storage key for multi-period support
const STORAGE_KEY_RECURRING = 'budgetTrackerRecurring'; // NEW storage key
const STORAGE_KEY_GOALS = 'budgetTrackerGoals'; // NEW storage key
const LAST_RECURRING_RUN_KEY = 'lastRecurringRun'; // Key for last run time

// List of all possible categories (used to populate the filter)
const EXPENSE_CATEGORIES = [
    'Uncategorized', 'Food', 'Transportation', 'Housing', 'Entertainment',
    'Shopping', 'Utilities', 'Other'
];
const ALL_CATEGORIES = [
    ...EXPENSE_CATEGORIES, 
    'Salary (Income)', 
    'Savings/Goal Contribution', 
    'Savings/Goal Withdrawal' 
];
const INCOME_CATEGORIES = ['Salary (Income)', 'Other', 'Savings/Goal Withdrawal']; 

const chartColors = ['#dc2626', '#f97316', '#8b5cf6', '#06b6d4', '#eab308', '#4b5563', '#9ca3af'];
const incomeColors = ['#059669', '#34d399', '#60a5fa', '#3b82f6', '#10b981'];

// Helper to generate a unique ID
const generateId = () => Date.now().toString() + Math.random().toString(16).slice(2);

// --- GLOBAL UTILITY FUNCTIONS (Exposed) ---

/**
 * Converts a number to a currency string format (Indian Rupees).
 * @param {number} amount - The numeric amount.
 * @returns {string} - The formatted currency string.
 */
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { 
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

/**
 * Displays a temporary notification message (replaces alert()).
 * @param {string} message - The message to display.
 * @param {string} type - 'success', 'error', or 'warning'.
 */
const showMessage = (message, type = 'success') => {
    const box = document.getElementById('message-box');
    box.textContent = message;
    box.className = 'show'; 

    box.classList.remove('bg-green-500', 'bg-red-500', 'bg-yellow-500', 'text-gray-800');

    if (type === 'success') {
        box.classList.add('bg-green-500');
    } else if (type === 'error') {
        box.classList.add('bg-red-500');
    } else if (type === 'warning') {
        box.classList.add('bg-yellow-500', 'text-gray-800'); 
    }

    setTimeout(() => {
        box.classList.remove('show');
        box.classList.remove('bg-green-500', 'bg-red-500', 'bg-yellow-500', 'text-gray-800');
    }, 3000);
};

window.formatCurrency = formatCurrency;
window.showMessage = showMessage;

// --- Storage Functions ---

function loadBudgets() {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY_BUDGETS);
        budgets = storedData ? JSON.parse(storedData) : {};
    } catch (e) {
        console.error("Error loading budgets from local storage:", e);
        budgets = {};
    }
}

function saveBudgets() {
    try {
        localStorage.setItem(STORAGE_KEY_BUDGETS, JSON.stringify(budgets));
        renderBudgetProgress(); 
        renderBudgetSettings(); 
    } catch (e) {
        console.error("Error saving budgets. Details:", e); 
        showMessage("Error saving budgets. Storage capacity may be full.", 'error'); 
    }
}

function loadRecurringTransactions() {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY_RECURRING);
        recurringTransactions = storedData ? JSON.parse(storedData) : [];
    } catch (e) {
        console.error("Error loading recurring transactions:", e);
        recurringTransactions = [];
    }
}

function saveRecurringTransactions() {
    try {
        localStorage.setItem(STORAGE_KEY_RECURRING, JSON.stringify(recurringTransactions));
        renderRecurringTransactions();
        renderActiveRecurringRules(); 
    } catch (e) {
        console.error("Error saving recurring transactions. Details:", e); 
        showMessage("Error saving recurring transactions. Storage capacity may be full.", 'error'); 
    }
}

function loadGoals() {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY_GOALS);
        goals = storedData ? JSON.parse(storedData) : [];
    } catch (e) {
        console.error("Error loading goals from local storage:", e);
        goals = [];
    }
}

function saveGoals() {
    try {
        localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(goals));
        renderGoalsProgress(); 
        renderActiveGoalsDashboard(); 
        checkGoalReminders(); 
    } catch (e) {
        console.error("Error saving goals. Details:", e); 
        showMessage("Error saving goals. Storage capacity may be full.", 'error'); 
    }
}


/**
 * Loads transactions array from the browser's localStorage.
 */
function loadTransactions() {
    try {
        const storedData = localStorage.getItem(STORAGE_KEY);
        transactions = storedData ? JSON.parse(storedData) : [];
    } catch (e) {
        console.error("Error loading transactions from local storage:", e);
        transactions = [];
    }
}

/**
 * Saves the current transactions array to the browser's localStorage and updates the UI.
 */
function saveTransactions(suppressMessage = false) {
    try {
        // Filter out any transactions without a proper timestamp before saving
        const transactionsToSave = transactions.filter(t => t.timestamp && typeof t.timestamp.seconds === 'number');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactionsToSave));
        
        // Manually trigger UI updates after saving
        renderSummary();
        renderRecentTransactions();
        renderBudgetProgress();
        renderActiveRecurringRules(); 
        renderActiveGoalsDashboard(); 
        checkGoalReminders(); 
        
        // Only render charts/lists if their view is currently visible
        if (!document.getElementById('analytics-view').classList.contains('hidden')) {
            aggregatedData = aggregateData(transactions, currentPeriod);
            renderCharts(aggregatedData);
        } else if (!document.getElementById('full-list-view').classList.contains('hidden')) {
             renderAllTransactions();
        }
        
    } catch (e) {
        console.error("Error saving data. Details:", e); 
        if (!suppressMessage) { 
             showMessage("Error saving data. Storage capacity may be full.", 'error'); 
        }
    }
}

// --- Goal Reminder Modal Logic ---

function resetModalStyle() {
    const modalContent = document.getElementById('budget-warning-content');
    const svg = modalContent.querySelector('svg');
    const h3 = modalContent.querySelector('h3');
    const editBtn = document.getElementById('modal-edit-budget-btn');
    
    // Reset Icon/Color to default Budget Warning
    svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.772-1.333-2.68-1.333-3.452 0L2.268 16c-.772 1.333.194 3 1.732 3z"></path>';
    svg.classList.remove('text-blue-500', 'text-red-500');
    svg.classList.add('text-yellow-500');
    h3.textContent = 'Budget Limit Warning!';
    
    // Reset edit button text to default (Budget)
    editBtn.innerHTML = `
        <span class="flex items-center justify-center space-x-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-7-5L19 3m0 0l-5 5m5-5v5m0-5h5"></path></svg>
            <span>EDIT BUDGET</span>
        </span>
    `;
    
    // Reset secondary button text
    document.querySelector('#budget-warning-content button:last-child').textContent = 'CONTINUE (Ignore for Now)';
}

function closeBudgetWarning() {
    document.getElementById('budget-warning-modal').classList.remove('active');
    document.getElementById('budget-warning-modal').style.display = 'none';
    resetModalStyle(); 
}

function showGoalReminder(goal, daysLeft) {
    resetModalStyle(); 

    const modal = document.getElementById('budget-warning-modal');
    const messageText = document.getElementById('warning-message-text');
    const modalContent = document.getElementById('budget-warning-content');
    const svg = modalContent.querySelector('svg');
    const h3 = modalContent.querySelector('h3');
    const editBtn = document.getElementById('modal-edit-budget-btn');

    // 1. Set Goal Context (use the same modal structure)
    h3.textContent = 'Goal Deadline Alert!';
    svg.classList.remove('text-yellow-500');
    svg.classList.add('text-blue-500'); 
    svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m4 0a1 1 0 100-2 1 1 0 000 2zm0 0l-1.558-.871a2 2 0 00-1.884 0L2 19h10zm7 0a1 1 0 100-2 1 1 0 000 2zm0 0l-1.558-.871a2 2 0 00-1.884 0L17 19h10zM12 4v16m-4-8h8"></path>'; 
    
    const statusText = daysLeft === 0 ? 'DUE TODAY' : `${daysLeft} DAYS LEFT`;
    const progress = (goal.currentAmount / goal.targetAmount) * 100;
    
    messageText.innerHTML = `
        Your goal **${goal.name}** is **${statusText}**!
        <br><br>
        Current Progress: **${Math.round(progress)}%**
        <br>
        Amount Remaining: ${formatCurrency(goal.targetAmount - goal.currentAmount)}
    `;

    // 2. Set Button Actions
    editBtn.innerHTML = `
        <span class="flex items-center justify-center space-x-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-7-5L19 3m0 0l-5 5m5-5v5m0-5h5"></path></svg>
            <span>VIEW GOAL</span>
        </span>
    `;
    editBtn.onclick = () => {
        closeBudgetWarning();
        showView('goals');
    };
    document.querySelector('#budget-warning-content button:last-child').textContent = 'ACKNOWLEDGE'; 

    // 3. Show Modal
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}


function checkGoalReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (document.getElementById('budget-warning-modal').classList.contains('active')) {
         return;
    }
    
    for (const goal of goals) {
        if (goal.targetDate && goal.currentAmount < goal.targetAmount) {
            const targetDate = new Date(goal.targetDate);
            targetDate.setHours(0, 0, 0, 0); 

            const diffTime = targetDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Check if the goal is due today or within the next 5 days
            if (diffDays >= 0 && diffDays <= 5) {
                showGoalReminder(goal, diffDays);
                return; 
            }
        }
    }
}

function showBudgetWarning(category, period, limit, spent, percentage) {
    resetModalStyle(); 

    const modal = document.getElementById('budget-warning-modal');
    const messageText = document.getElementById('warning-message-text');
    const editBtn = document.getElementById('modal-edit-budget-btn');
    
    // Re-set context for Budget Warning
    document.querySelector('#budget-warning-content h3').textContent = 'Budget Limit Warning!';

    messageText.innerHTML = `
        The **${category} (${period})** budget has reached **${Math.round(percentage)}%** of its limit of **${formatCurrency(limit)}**.
        <br><br>
        Current Spent: ${formatCurrency(spent)}
    `;
    
    // Set data attributes on the edit button for later use
    editBtn.dataset.category = category;
    editBtn.dataset.period = period;
    
    // Attach temporary listener to the edit button
    editBtn.onclick = () => {
        navigateToBudgetSettings(category, period);
    };

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10); 
}

// --- Recurring Transaction Logic ---

function getNextRecurrenceDate(rule, startDate) {
     const lastDate = new Date(startDate);
     const now = new Date();
     let nextDate = new Date(lastDate);
     
     // Ensure we always move forward in time
     do {
         nextDate = new Date(nextDate); // Clone date for mutation
         if (rule.frequency === 'Daily') {
             nextDate.setDate(nextDate.getDate() + 1);
         } else if (rule.frequency === 'Weekly') {
             nextDate.setDate(nextDate.getDate() + 7);
         } else if (rule.frequency === 'Monthly') {
             // Increment month, then set the day of month, handling end-of-month correctly
             nextDate.setMonth(nextDate.getMonth() + 1);
             const dayOfMonth = rule.day;
             // Only set day if it's less than the last day of the new month
             const maxDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
             nextDate.setDate(Math.min(dayOfMonth, maxDay));
         } else if (rule.frequency === 'Yearly') {
             nextDate.setFullYear(nextDate.getFullYear() + 1);
         }
         // Reset time to ensure consistency (00:00:00 of the calculated day)
         nextDate.setHours(0, 0, 0, 0);

     } while (nextDate <= now);

     return nextDate; 
}

function processRecurringTransactions() {
     const now = new Date();
     now.setHours(0, 0, 0, 0); 
     let newTransactionsGenerated = 0;
     let newRecurringRules = [...recurringTransactions]; 

     newRecurringRules = newRecurringRules.map(rule => {
         let lastDate = rule.lastGenerated || rule.createdAt;
         let currentDate = new Date(lastDate);
         currentDate.setHours(0, 0, 0, 0);

         while (currentDate <= now) {
              if (currentDate.getTime() === new Date(lastDate).getTime()) {
                  currentDate = getNextRecurrenceDate({ ...rule, day: rule.day || 1 }, currentDate);
                  if (currentDate > now) break;
              }

             let shouldGenerate = false;
             let nextOccurrence = new Date(currentDate);

             if (rule.frequency === 'Daily') {
                 shouldGenerate = true;
                 nextOccurrence.setDate(nextOccurrence.getDate() + 1); 
             } else if (rule.frequency === 'Weekly') {
                 if (currentDate.getDay() === rule.day) {
                     shouldGenerate = true;
                 }
                 nextOccurrence.setDate(nextOccurrence.getDate() + 1);
             } else if (rule.frequency === 'Monthly') {
                 if (currentDate.getDate() === rule.day) {
                     shouldGenerate = true;
                 }
                 nextOccurrence.setDate(nextOccurrence.getDate() + 1);
             } else if (rule.frequency === 'Yearly') {
                 if (currentDate.getDate() === rule.day && currentDate.getMonth() === new Date(rule.createdAt).getMonth()) {
                     shouldGenerate = true;
                 }
                 nextOccurrence.setDate(nextOccurrence.getDate() + 1);
             }

             if (shouldGenerate) {
                 const newTransaction = {
                     id: generateId(),
                     description: `${rule.description} (Auto)`,
                     amount: Number(rule.amount),
                     type: rule.type,
                     category: rule.category,
                     timestamp: { seconds: Math.floor(currentDate.getTime() / 1000) },
                     recurringId: rule.id 
                 };
                 transactions.push(newTransaction);
                 newTransactionsGenerated++;
                 rule.lastGenerated = currentDate.getTime(); 
             }

             if (currentDate.getTime() === nextOccurrence.getTime()) {
                 break; 
             }
             currentDate = nextOccurrence;
             
             const diffDays = Math.floor((now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
             if (diffDays > 365 * 2) break; 
         }

         if (rule.lastGenerated > lastDate) {
             rule.lastGenerated = currentDate.getTime();
         }
         
         return rule;
     });

     if (newTransactionsGenerated > 0) {
         recurringTransactions = newRecurringRules;
         saveRecurringTransactions(); 
         saveTransactions(true); 
         showMessage(`${newTransactionsGenerated} recurring transactions generated.`, 'success');
     }
}

/**
 * Renders a summary of active recurring rules on the dashboard.
 */
function renderActiveRecurringRules() {
    const listElement = document.getElementById('active-recurring-dashboard-list');
    listElement.innerHTML = '';
    
    const activeRules = recurringTransactions.slice(0, 3); 
    
    if (activeRules.length === 0) {
        listElement.innerHTML = '<p class="text-center text-gray-500 text-sm">No recurring schedules found. <a onclick="showView(\'recurring\')" class="text-blue-500 hover:text-blue-700 cursor-pointer">Set one now!</a></p>';
        return;
    }

    activeRules.forEach(rule => {
         const isIncome = rule.type === 'income';
         const typeClass = isIncome ? 'text-emerald-600' : 'text-red-600';
         const sign = isIncome ? '+' : '-';
         
         let frequencyText = rule.frequency;
         if (rule.frequency === 'Monthly') frequencyText = `Monthly (Day ${rule.day})`;
         else if (rule.frequency === 'Weekly') frequencyText = `Weekly (Day ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][rule.day]})`;

         const item = document.createElement('div');
         item.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg shadow-sm';
         item.innerHTML = `
              <div class="min-w-0">
                  <p class="text-sm font-bold text-gray-800 truncate">${rule.description}</p>
                  <p class="text-xs text-gray-500">${frequencyText} · ${rule.category}</p>
              </div>
              <span class="text-lg font-extrabold ${typeClass} flex-shrink-0">
                  ${sign}${formatCurrency(rule.amount)}
              </span>
         `;
         listElement.appendChild(item);
    });
}

/**
 * Function to pre-populate the recurring form for editing.
 */
function editRecurring(ruleId) {
    const rule = recurringTransactions.find(r => r.id === ruleId);
    if (!rule) return;

    // Set type radio button
    document.querySelector(`input[name="recurringType"][value="${rule.type}"]`).checked = true;
    
    document.getElementById('recurring-description').value = rule.description;
    document.getElementById('recurring-amount').value = rule.amount;
    document.getElementById('recurring-category').value = rule.category;
    document.getElementById('recurring-frequency').value = rule.frequency;
    
    // Toggle correct day/date input visibility and set value
    toggleRecurringDayInput(rule.frequency);

    if (rule.frequency === 'Monthly' || rule.frequency === 'Yearly') {
        document.getElementById('recurring-day-of-month').value = rule.day;
    } else if (rule.frequency === 'Weekly') {
        document.getElementById('recurring-day-of-week').value = rule.day;
    }
    
    // Change the form button text to indicate editing
    const submitBtn = document.querySelector('#recurring-form button[type="submit"]');
    submitBtn.textContent = 'UPDATE RECURRING RULE';
    submitBtn.dataset.editId = rule.id; 
    
    showMessage(`Editing recurring rule: ${rule.description}. Scroll up to edit.`, 'warning');
    // Scroll to form
    document.getElementById('recurring-transactions-view').scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Renders the active recurring transaction rules list.
 */
function renderRecurringTransactions() {
     const listElement = document.getElementById('active-recurring-list');
     listElement.innerHTML = '';

     if (recurringTransactions.length === 0) {
         listElement.innerHTML = '<p class="text-center text-gray-500 p-2">No recurring rules currently set.</p>';
         return;
     }
     
     recurringTransactions.forEach(rule => {
         let nextRunDate = 'N/A';
         let frequencyText = rule.frequency;
         
         if (rule.frequency === 'Weekly') {
             const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
             frequencyText = `Weekly (Every ${days[rule.day]})`;
         } else if (rule.frequency === 'Monthly') {
             frequencyText = `Monthly (Day ${rule.day})`;
         } else if (rule.frequency === 'Yearly') {
             frequencyText = `Yearly (Day ${rule.day} of ${new Date(rule.createdAt).toLocaleString('en-US', { month: 'long' })})`;
         }
         
         try {
             let approximationDate = rule.lastGenerated ? new Date(rule.lastGenerated) : new Date(rule.createdAt);
             let nextDate = getNextRecurrenceDate(rule, approximationDate); 
             nextRunDate = nextDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
             
         } catch (e) {
              console.error("Error calculating next recurrence date:", e);
         }

         const isIncome = rule.type === 'income';
         const typeClass = isIncome ? 'text-emerald-600' : 'text-red-600';
         const typeIcon = isIncome ? `<svg class="w-5 h-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm-2-7V7h2v3h-2z"/></svg>` : `<svg class="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9h4v2h-4v-2z"/></svg>`;

         const item = document.createElement('div');
         item.className = 'recurring-item p-4 flex justify-between items-center space-x-3';
         item.innerHTML = `
              <div class="flex items-center space-x-3 min-w-0 flex-1">
                  <div class="p-2 rounded-full ${isIncome ? 'bg-emerald-100' : 'bg-red-100'}">${typeIcon}</div>
                  <div class="min-w-0">
                      <p class="text-sm font-bold text-gray-900 truncate">${rule.description}</p>
                      <p class="text-xs text-gray-500">${rule.category} - ${frequencyText}</p>
                  </div>
              </div>
              <div class="text-right flex items-center space-x-2">
                  <p class="text-lg font-extrabold ${typeClass} flex-shrink-0">${formatCurrency(rule.amount)}</p>
                  <button class="edit-recurring-btn text-gray-400 hover:text-blue-500 transition-colors duration-150 p-1 rounded" data-id="${rule.id}" title="Edit Recurring Rule">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                  </button>
              </div>
              <button class="delete-recurring-btn text-gray-400 hover:text-red-500 transition-colors duration-150 p-1 rounded" data-id="${rule.id}" title="Delete Recurring Rule">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
         `;
         
         listElement.appendChild(item);
     });
     
     // Attach listeners
     listElement.querySelectorAll('.delete-recurring-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
              const idToDelete = e.currentTarget.dataset.id;
              recurringTransactions = recurringTransactions.filter(r => r.id !== idToDelete);
              saveRecurringTransactions();
              showMessage('Recurring rule removed.', 'success');
          });
     });
     listElement.querySelectorAll('.edit-recurring-btn').forEach(btn => {
          btn.addEventListener('click', (e) => editRecurring(e.currentTarget.dataset.id));
     });
}

// --- End Recurring Transaction Logic ---


// --- Goal Logic ---

/**
 * Function to pre-populate the goal form for editing.
 */
function editGoal(goalId) {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    document.getElementById('goal-name').value = goal.name;
    document.getElementById('goal-target-amount').value = goal.targetAmount;
    document.getElementById('goal-target-date').value = goal.targetDate || '';
    
    // Change the form button text to indicate editing
    const submitBtn = document.querySelector('#goal-form button[type="submit"]');
    submitBtn.textContent = 'UPDATE GOAL';
    submitBtn.dataset.editId = goal.id; 
    
    showMessage(`Editing goal: ${goal.name}. Scroll up to edit.`, 'warning');
    // Scroll to form
    document.getElementById('savings-goals-view').scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Renders a summary of active goals on the dashboard.
 */
function renderActiveGoalsDashboard() {
    const listElement = document.getElementById('active-goals-dashboard-list');
    listElement.innerHTML = '';
    
    const activeGoals = goals.filter(g => g.currentAmount < g.targetAmount).slice(0, 3); 
    
    if (activeGoals.length === 0) {
        listElement.innerHTML = '<p class="text-center text-gray-500 text-sm">No active goals set. <a onclick="showView(\'goals\')" class="text-blue-500 hover:text-blue-700 cursor-pointer">Start a new goal!</a></p>';
        return;
    }

    activeGoals.forEach(goal => {
        const percentage = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
        const remaining = goal.targetAmount - goal.currentAmount;
        const progressColor = percentage >= 100 ? 'bg-emerald-600' : 'bg-blue-600';
        
        const item = document.createElement('div');
        item.className = 'flex flex-col space-y-1 p-3 bg-gray-50 rounded-lg shadow-sm cursor-pointer hover:bg-gray-100 transition-colors duration-150';
        item.onclick = () => showView('goals');
        
        item.innerHTML = `
            <div class="flex justify-between items-center">
                <p class="text-sm font-bold text-gray-800 truncate">${goal.name}</p>
                <span class="text-xs font-semibold ${percentage >= 100 ? 'text-emerald-600' : 'text-blue-600'}">${Math.round(percentage)}%</span>
            </div>
            <div class="flex justify-between items-end text-xs font-medium">
                <span class="text-gray-500">${formatCurrency(goal.currentAmount)} / ${formatCurrency(goal.targetAmount)}</span>
                <span class="${percentage >= 100 ? 'text-emerald-600' : 'text-gray-600'}">${formatCurrency(remaining)} Left</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-1.5">
                <div class="h-1.5 rounded-full ${progressColor} transition-all duration-500" style="width: ${percentage}%"></div>
            </div>
        `;
        listElement.appendChild(item);
    });
}

/**
 * Renders the goals progress in the dedicated view.
 */
function renderGoalsProgress() {
    const listElement = document.getElementById('active-goals-list');
    listElement.innerHTML = '';

    if (goals.length === 0) {
         listElement.innerHTML = '<p class="text-center text-gray-500 p-2">No savings goals defined. Use the form above to create your first goal!</p>';
         return;
    }

    goals.forEach(goal => {
        const percentage = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
        const remaining = goal.targetAmount - goal.currentAmount;
        const progressColor = percentage >= 100 ? 'bg-emerald-600' : 'bg-blue-600';
        const statusText = percentage >= 100 ? 'Achieved!' : `Saving (${Math.round(percentage)}%)`;
        const dateDisplay = goal.targetDate ? `Target: ${new Date(goal.targetDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : 'No Target Date';
        
        // --- IMPRESSIVE GOAL CARD UI ---
        const goalElement = document.createElement('div');
        goalElement.className = 'primary-card p-5 space-y-3 border-l-4 border-blue-600 shadow-xl';
        goalElement.innerHTML = `
             <div class="flex justify-between items-start">
                 <div>
                     <h4 class="text-lg font-extrabold text-gray-900">${goal.name}</h4>
                     <p class="text-xs text-gray-500">${dateDisplay}</p>
                 </div>
                 <div class="flex items-center space-x-2">
                     <button class="edit-goal-btn text-gray-400 hover:text-blue-500 p-1 rounded" data-id="${goal.id}" title="Edit Goal">
                         <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                     </button>
                     <button class="delete-goal-btn text-gray-400 hover:text-red-500 p-1 rounded" data-id="${goal.id}" title="Delete Goal">
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                     </button>
                 </div>
             </div>
             
             <div class="space-y-1">
                 <div class="flex justify-between items-center text-sm font-semibold">
                      <span class="text-gray-800">${statusText}</span>
                      <span class="${percentage >= 100 ? 'text-emerald-600 font-extrabold' : 'text-gray-600'}">${formatCurrency(goal.currentAmount)} / ${formatCurrency(goal.targetAmount)}</span>
                 </div>
                 <div class="w-full bg-gray-200 rounded-full h-3">
                      <div class="h-3 rounded-full ${progressColor} transition-all duration-500" style="width: ${percentage}%"></div>
                 </div>
                 <p class="text-xs text-right ${percentage >= 100 ? 'text-emerald-600 font-bold' : 'text-gray-500'}">
                     ${percentage < 100 ? `${formatCurrency(remaining)} Left to Go` : 'Goal Complete!'}
                 </p>
             </div>

             <div class="mt-4 pt-3 border-t border-gray-100 space-y-3">
                 <h5 class="text-xs font-bold text-gray-700">Manage Contributions:</h5>
                 
                 <div class="flex space-x-2">
                     <input type="number" id="deposit-amount-${goal.id}" placeholder="Deposit Amount" step="1" min="1"
                             class="flex-1 rounded-lg border-emerald-300 shadow-sm p-2 border focus:ring-emerald-500 focus:border-emerald-500 text-sm">
                     <button class="deposit-btn py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition duration-150 text-sm flex-shrink-0" data-id="${goal.id}">
                          Deposit
                     </button>
                 </div>
                 
                 <div class="flex space-x-2">
                     <input type="number" id="withdraw-amount-${goal.id}" placeholder="Withdraw Amount" step="1" min="1"
                             class="flex-1 rounded-lg border-red-300 shadow-sm p-2 border focus:ring-red-500 focus:border-red-500 text-sm">
                     <button class="withdraw-btn py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition duration-150 text-sm flex-shrink-0" data-id="${goal.id}">
                          Withdraw
                     </button>
                 </div>
             </div>
         `;
        listElement.appendChild(goalElement);
    });

    // Attach Deposit Listeners
    listElement.querySelectorAll('.deposit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const goalId = e.currentTarget.dataset.id;
            const inputId = `deposit-amount-${goalId}`;
            const depositAmount = parseFloat(document.getElementById(inputId).value);
            
            if (!isNaN(depositAmount) && depositAmount > 0) {
                depositToGoal(goalId, depositAmount);
                document.getElementById(inputId).value = ''; 
            } else {
                showMessage("Please enter a valid deposit amount.", 'warning');
            }
        });
    });
    
    // NEW: Attach Withdrawal Listeners
    listElement.querySelectorAll('.withdraw-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const goalId = e.currentTarget.dataset.id;
            const inputId = `withdraw-amount-${goalId}`;
            const withdrawAmount = parseFloat(document.getElementById(inputId).value);
            
            if (!isNaN(withdrawAmount) && withdrawAmount > 0) {
                withdrawFromGoal(goalId, withdrawAmount);
                document.getElementById(inputId).value = ''; 
            } else {
                showMessage("Please enter a valid withdrawal amount.", 'warning');
            }
        });
    });
    
    // Attach Delete Listeners
    listElement.querySelectorAll('.delete-goal-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const goalId = e.currentTarget.dataset.id;
            deleteGoal(goalId);
        });
    });
     // Attach Edit Listeners
    listElement.querySelectorAll('.edit-goal-btn').forEach(button => {
        button.addEventListener('click', (e) => editGoal(e.currentTarget.dataset.id));
    });
}

// Core logic for depositing funds
function depositToGoal(goalId, amount) {
    const goalIndex = goals.findIndex(g => g.id === goalId);
    if (goalIndex === -1) return;

    // 1. Update the goal's current amount
    goals[goalIndex].currentAmount += amount;
    
    // 2. IMPORTANT: Create a corresponding Expense Transaction
    const newGoalTransaction = {
        id: generateId(),
        description: `Goal Deposit: ${goals[goalIndex].name}`,
        amount: amount,
        type: 'expense', 
        category: 'Savings/Goal Contribution', 
        timestamp: { seconds: Math.floor(Date.now() / 1000) }
    };
    
    transactions.push(newGoalTransaction);
    
    // Save both goals and transactions
    saveGoals();
    saveTransactions(); 
    
    showMessage(`₹${amount.toFixed(2)} deposited to ${goals[goalIndex].name}.`, 'success');
    
    if (goals[goalIndex].currentAmount >= goals[goalIndex].targetAmount) {
         showMessage(`🎉 Goal Reached: ${goals[goalIndex].name}!`, 'success');
    }
}

/**
 * Core logic for withdrawing funds from a goal.
 */
function withdrawFromGoal(goalId, amount) {
    const goalIndex = goals.findIndex(g => g.id === goalId);
    if (goalIndex === -1) return;

    const goal = goals[goalIndex];

    if (amount > goal.currentAmount) {
        showMessage(`Cannot withdraw ${formatCurrency(amount)}. Only ${formatCurrency(goal.currentAmount)} available in ${goal.name}.`, 'error');
        return;
    }

    // 1. Update the goal's current amount (Deduct)
    goal.currentAmount -= amount;

    // 2. IMPORTANT: Create a corresponding Income Transaction
    const newWithdrawalTransaction = {
        id: generateId(),
        description: `Goal Withdrawal: ${goal.name}`,
        amount: amount,
        type: 'income', 
        category: 'Savings/Goal Withdrawal', 
        timestamp: { seconds: Math.floor(Date.now() / 1000) }
    };
    
    transactions.push(newWithdrawalTransaction);
    
    // Save both goals and transactions
    saveGoals(); 
    saveTransactions(); 

    showMessage(`₹${amount.toFixed(2)} withdrawn from ${goal.name}. Liquid balance increased.`, 'warning');
}

function deleteGoal(goalId) {
    goals = goals.filter(g => g.id !== goalId);
    saveGoals();
    showMessage("Savings goal removed.");
}

// --- End Goal Logic ---


/**
 * Initializes the application data in local storage mode.
 */
function initLocalData() {
    document.getElementById('loading-message')?.remove();
    loadTransactions();
    loadBudgets(); 
    loadRecurringTransactions(); 
    loadGoals(); 
    processRecurringTransactions(); 

    // Set today's date as the default for the Quick Add form
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); 
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('date').value = `${yyyy}-${mm}-${dd}`; 
    
    // Time input is left blank to allow user to set it.
    document.getElementById('time').value = '';

    saveTransactions(); 
    populateCategoryFilter(); 
    populateBudgetCategoryFilter(); 
    populateRecurringCategoryFilter(); 
}

// --- Remaining Helper Functions ---

/**
 * Populates the category filter dropdown in the full list view and recurring form.
 */
function populateCategoryFilter() {
    const filterElement = document.getElementById('category-filter');
    if (!filterElement) return;

    // Clear existing options
    filterElement.innerHTML = '';

    // Add the default 'All Categories' option
    let optionAll = document.createElement('option');
    optionAll.value = 'All';
    optionAll.textContent = 'All Categories';
    filterElement.appendChild(optionAll);

    // Add all other predefined categories
    ALL_CATEGORIES.forEach(category => {
        let option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        filterElement.appendChild(option);
    });
}

/**
 * Populates the category filter dropdown in the budget settings view.
 */
function populateBudgetCategoryFilter() {
     const filterElement = document.getElementById('budget-category');
    if (!filterElement) return;

    filterElement.innerHTML = '';
    
    // Add EXPENSE categories only (as budgets are typically for expenses)
    EXPENSE_CATEGORIES.forEach(category => {
        let option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        filterElement.appendChild(option);
    });
    
    // Trigger load for the initially selected category
    loadBudgetForEdit(filterElement.value); 
}

/**
 * Populates the category dropdown in the recurring form.
 */
function populateRecurringCategoryFilter() {
     const filterElement = document.getElementById('recurring-category');
    if (!filterElement) return;

    filterElement.innerHTML = '';
    
    // Add EXPENSE and INCOME categories, excluding Savings/Goal Contribution for clean setup
    [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].forEach(category => {
        let option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        filterElement.appendChild(option);
    });
}

/**
 * Hides/shows the Day of Week/Month input based on the selected frequency.
 */
function toggleRecurringDayInput(frequency) {
     document.getElementById('recurring-day-input-monthly').classList.add('hidden');
     document.getElementById('recurring-day-input-weekly').classList.add('hidden');
     
     if (frequency === 'Monthly' || frequency === 'Yearly') {
         document.getElementById('recurring-day-input-monthly').classList.remove('hidden');
     } else if (frequency === 'Weekly') {
         document.getElementById('recurring-day-input-weekly').classList.remove('hidden');
     }
}

/**
 * Loads existing budget amount and period into the input field for editing.
 */
function loadBudgetForEdit(category) {
    const amountInput = document.getElementById('budget-amount');
    const periodSelector = document.querySelector(`input[name="budgetPeriod"]:checked`);
    const period = periodSelector ? periodSelector.value : currentBudgetPeriod; 
    
    const budget = budgets[category]?.[period] || 0;
    amountInput.value = budget;
}

/**
 * Renders the budget progress bars on the dashboard.
 */
function renderBudgetProgress() {
    const listElement = document.getElementById('budget-progress-list');
    listElement.innerHTML = '';
    
    // 1. Calculate current expense totals by category and period for today
    const periodExpenses = transactions.reduce((acc, t) => {
        if (t.type === 'expense' && t.timestamp && typeof t.timestamp.seconds === 'number') {
            const date = new Date(t.timestamp.seconds * 1000);
            const amount = Number(t.amount);
            
            acc[t.category] = acc[t.category] || {};

            // Calculate Daily spending for today
            if (date.toDateString() === new Date().toDateString()) {
               acc[t.category]['Daily'] = (acc[t.category]['Daily'] || 0) + amount;
            }
            // Calculate Monthly spending for this month
            if (date.getFullYear() === new Date().getFullYear() && date.getMonth() === new Date().getMonth()) {
                acc[t.category]['Monthly'] = (acc[t.category]['Monthly'] || 0) + amount;
            }
            // Calculate Yearly spending for this year
            if (date.getFullYear() === new Date().getFullYear()) {
               acc[t.category]['Yearly'] = (acc[t.category]['Yearly'] || 0) + amount;
            }
        }
        return acc;
    }, {});
    
    let hasBudgets = false;
    
    // 2. Render progress bar for each set budget (all periods)
    for (const category in budgets) {
        for (const period in budgets[category]) {
            const limit = Number(budgets[category][period]);
            
            if (limit > 0) {
                const spent = periodExpenses[category]?.[period] || 0;
                const percentage = limit > 0 ? Math.min(100, (spent / limit) * 100) : (spent > 0 ? 100 : 0);
                
                let progressBarClass = 'bg-budget-green';
                let statusText = 'On Track';
                
                if (percentage >= 100) {
                    progressBarClass = 'bg-budget-red';
                    statusText = 'Limit Exceeded!';
                } else if (percentage >= 80) {
                    progressBarClass = 'bg-budget-orange';
                    statusText = 'Approaching Limit';
                }
                
                const remaining = limit - spent;
                const progressElement = document.createElement('div');
                progressElement.className = 'space-y-1';
                progressElement.innerHTML = `
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-semibold text-gray-800">${category} (${period})</span>
                        <span class="text-xs font-medium ${progressBarClass.replace('bg-', 'text-')}">${statusText}</span>
                    </div>
                    <div class="flex justify-between items-end text-xs font-medium">
                        <span class="text-gray-500">${formatCurrency(spent)} / ${formatCurrency(limit)}</span>
                        <span class="${remaining < 0 ? 'text-red-600 font-bold' : 'text-gray-600'}">${formatCurrency(Math.abs(remaining))} ${remaining < 0 ? 'Over' : 'Left'}</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2.5">
                        <div class="h-2.5 rounded-full ${progressBarClass} transition-all duration-500" style="width: ${percentage}%"></div>
                    </div>
                `;
                listElement.appendChild(progressElement);
                hasBudgets = true;
            }
        }
    }
    
    if (!hasBudgets) {
         listElement.innerHTML = '<p class="text-center text-gray-500 text-sm">No budgets set. Click \'Set/Edit Budgets\' to start tracking goals!</p>';
    }
}

function renderBudgetSettings() {
    const listElement = document.getElementById('current-budgets-list');
    listElement.innerHTML = '';
    
    let hasBudgets = false;
    
    for (const category in budgets) {
        for (const period in budgets[category]) {
            const limit = Number(budgets[category][period]);

            if (limit > 0) {
                const budgetElement = document.createElement('div');
                budgetElement.className = 'flex justify-between items-center p-3 bg-gray-50 rounded-lg';
                budgetElement.innerHTML = `
                    <span class="font-semibold text-gray-800">${category} (${period})</span>
                    <div class="flex items-center space-x-3">
                        <span class="text-lg font-bold text-blue-600">${formatCurrency(limit)}</span>
                        
                        <button class="edit-budget-btn text-gray-400 hover:text-blue-500 transition-colors duration-150 p-1 rounded"
                                    data-category="${category}" data-period="${period}" title="Edit Budget">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        </button>

                        <button class="delete-budget-btn text-gray-400 hover:text-red-500 transition-colors duration-150 p-1 rounded"
                                    data-category="${category}" data-period="${period}" title="Remove Budget">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                `;
                listElement.appendChild(budgetElement);
                hasBudgets = true;
            }
        }
    }

    if (!hasBudgets) {
         listElement.innerHTML = '<p class="text-center text-gray-500 p-2">No budgets currently set.</p>';
    }
     // Attach delete listeners
    listElement.querySelectorAll('.delete-budget-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.currentTarget.dataset.category;
            const period = e.currentTarget.dataset.period;
            if (budgets[category] && budgets[category][period]) {
                delete budgets[category][period];
                // Clean up category key if it's empty
                if (Object.keys(budgets[category]).length === 0) {
                    delete budgets[category];
                }
                saveBudgets();
                showMessage(`Budget for ${category} (${period}) removed.`, 'warning');
            }
        });
    });

    // Attach edit listeners
    listElement.querySelectorAll('.edit-budget-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const category = e.currentTarget.dataset.category;
            const period = e.currentTarget.dataset.period;
            navigateToBudgetSettings(category, period);
        });
    });
}

function navigateToBudgetSettings(category, period) {
    closeBudgetWarning();
    
    showView('budget-settings'); 
    
    setTimeout(() => {
        document.getElementById('budget-category').value = category;
        const periodRadio = document.querySelector(`input[name="budgetPeriod"][value="${period}"]`);
        if (periodRadio) periodRadio.checked = true;
        
        updateBudgetPeriod(period); 
        
        document.getElementById('budget-settings-view').scrollTo({ top: 0, behavior: 'smooth' });
    }, 50); 
}

function addTransaction(transactionData) {
    
    const newId = generateId();
    
    let timestampSeconds;
    
    const dateString = document.getElementById('date').value;
    const timeString = document.getElementById('time').value;
    const now = new Date(); 

    let baseDate = now;
    if (dateString) {
        baseDate = new Date(dateString);
    }
    if (timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        baseDate.setHours(hours, minutes, 0, 0);
    } else if (dateString && !timeString) {
        baseDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    }

    timestampSeconds = Math.floor(baseDate.getTime() / 1000);

    const newTransaction = {
        id: newId,
        description: transactionData.description,
        amount: Number(transactionData.amount),
        type: transactionData.type,
        category: transactionData.category,
        timestamp: { seconds: timestampSeconds }
    };

    let budgetWarningDetails = null;

    transactions.push(newTransaction);
    saveTransactions();
    
    if (budgetWarningDetails) {
        // Simplified for brevity, normally calculated by comparing new transaction
        showBudgetWarning(newTransaction.category, 'Monthly', 1000, 950, 95); 
    } else {
        showMessage("Transaction added successfully!", 'success');
    }
}

function deleteTransaction(docId) {
    transactions = transactions.filter(t => t.id !== docId);
    saveTransactions();
    showMessage("Transaction deleted.");
}

function addImportedTransaction(description, amount, category, type = 'expense') {
    const newId = generateId();
    const timestampSeconds = Math.floor(Date.now() / 1000); 

    const newTransaction = {
         id: newId,
         description: description,
         amount: Math.abs(Number(amount)), 
         type: type,
         category: category,
         timestamp: { seconds: timestampSeconds }
    };
    
    transactions.push(newTransaction);
}

// --- Analytics Chart Functions ---

/**
 * Helper function to render a single Doughnut Chart (used for both Income and Expense)
 */
function renderDoughnutChart(chartVar, ctxId, labels, data, totalMetricId, totalColor, colors, centerTextId) {
     if (chartVar && chartVar.destroy) chartVar.destroy();

     const totalAmount = data.reduce((sum, val) => sum + val, 0);
     
     // Update Total Metric Display below chart
     const totalMetricElement = document.getElementById(totalMetricId);
     if (totalMetricElement) {
         totalMetricElement.textContent = formatCurrency(totalAmount);
         totalMetricElement.classList.remove('text-red-600', 'text-emerald-600');
         totalMetricElement.classList.add(totalColor === 'text-red-600' ? 'text-red-600' : 'text-emerald-600');
     }

     const percentageElement = document.getElementById(centerTextId.replace('-text', '-percentage'));
     if (percentageElement) {
          percentageElement.textContent = ' '; 
     }
     
     const ctx = document.getElementById(ctxId)?.getContext('2d');
     if (!ctx) return null;
     
     // Create and return the new chart instance
     const newChart = new Chart(ctx, {
         type: 'doughnut',
         data: {
             labels: labels,
             datasets: [{
                 data: data,
                 backgroundColor: colors.slice(0, labels.length),
                 hoverOffset: 10,
                 borderWidth: 8, 
                 borderColor: 'white' 
             }]
         },
         options: {
             responsive: true, maintainAspectRatio: false,
             cutout: '80%', 
             plugins: { 
                 legend: { 
                     position: 'right', 
                     labels: { 
                         usePointStyle: true, 
                         boxWidth: 8, 
                         padding: 15, 
                         color: '#374151', 
                         font: { weight: '600' } 
                     } 
                 }, 
                 title: { display: false },
                 datalabels: {
                     formatter: (value, context) => {
                         if (totalAmount === 0) return '';
                         const percentage = Math.round((value / totalAmount) * 100);
                         return percentage > 10 ? percentage + '%' : '';  
                     },
                     color: '#fff',
                     font: { weight: 'extrabold', size: 14 }, 
                     textShadowBlur: 4,
                     textShadowColor: 'rgba(0, 0, 0, 0.5)'
                 },
                  tooltip: {
                      callbacks: {
                          label: function(context) {
                              const value = context.parsed;
                              const percentage = totalAmount === 0 ? 0 : Math.round((value / totalAmount) * 100);
                              return `${context.label}: ${formatCurrency(value)} (${percentage}%)`;
                          }
                      }
                  }
             }
         },
         plugins: [ChartDataLabels]
     });
     return newChart;
}

function renderTrendChart(data, viewMode) {
    if (trendChart) trendChart.destroy();

    const trendCtx = document.getElementById('spendingTrendChart')?.getContext('2d');
    if (!trendCtx) return;
    
    const mainExpense = '#dc2626'; 
    const mainIncome = '#059669'; 
    const deficitColor = '#dc2626'; 
    const surplusColor = '#059669'; 
    const gridColor = 'rgba(0, 0, 0, 0.08)'; 
    
    let datasets = [];
    let chartType = 'bar';
    let yAxesTitle = 'Amount (₹)';

    const baseBarProps = {
        borderWidth: 0,
        borderRadius: 8, 
        barPercentage: 0.7, 
        categoryPercentage: 0.8,
        backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return null;
            
            const label = context.dataset.label;
            const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);

            if (label === 'Expenses') {
                gradient.addColorStop(0, '#991b1b'); 
                gradient.addColorStop(1, mainExpense); 
                return gradient;
            } else if (label === 'Income') {
                gradient.addColorStop(0, '#047857'); 
                gradient.addColorStop(1, mainIncome); 
                return gradient;
            } else if (label === 'Net Flow') {
                const value = context.parsed.y;
                const color = value >= 0 ? surplusColor : deficitColor;
                const lightColor = value >= 0 ? '#34d399' : '#fca5a5';
                
                gradient.addColorStop(0, color);
                gradient.addColorStop(1, lightColor);
                return gradient;
            }
            return mainExpense; 
        }
    };

    if (viewMode === 'expense') {
        datasets.push({ label: 'Expenses', data: data.trendDataExpense, ...baseBarProps });
        yAxesTitle = 'Expense Amount (₹)';
    } else if (viewMode === 'income_expense') {
        datasets.push({ label: 'Income', data: data.trendDataIncome, ...baseBarProps });
        datasets.push({ label: 'Expenses', data: data.trendDataExpense, ...baseBarProps });
        yAxesTitle = 'Amount (₹)';
    } else if (viewMode === 'net_flow') {
        datasets.push({ label: 'Net Flow', data: data.trendDataNetFlow, ...baseBarProps });
        yAxesTitle = 'Net Balance (₹)';
    }
    
    const periodText = (currentPeriod) => {
        if (currentPeriod === 'day') return 'Daily';
        if (currentPeriod === 'week') return 'Weekly';
        if (currentPeriod === 'month') return 'Monthly';
        if (currentPeriod === 'year') return 'Yearly';
        return 'Trend';
    };
    document.getElementById('trend-chart-title').textContent = `${periodText(currentPeriod)} Spending Trends`;

    trendChart = new Chart(trendCtx, {
        type: chartType, 
        data: { labels: data.trendLabels, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: false, 
                    grid: { display: false },
                    ticks: { color: '#4b5563', font: { weight: '600' } }
                },
                y: {
                    stacked: false, 
                    beginAtZero: true, 
                    title: { display: true, text: yAxesTitle, color: '#1f2937', font: { weight: 'bold' } }, 
                    ticks: { color: '#4b5563', callback: (value) => formatCurrency(value) },
                    grid: { color: gridColor, lineWidth: 1 } 
                }
            },
            
            plugins: { 
                legend: { 
                    display: viewMode === 'income_expense', 
                    position: 'bottom',
                    labels: { 
                        usePointStyle: true, 
                        boxWidth: 6, 
                        color: '#374151', 
                        font: { weight: '600' } 
                    }
                }, 
                title: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(31, 41, 55, 0.9)', 
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 14 },
                    cornerRadius: 6,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += formatCurrency(context.parsed.y);
                            return label;
                        }
                    }
                },
            }
        },
        plugins: []
    });
}

function renderCharts(data) {
     const selectedView = document.querySelector('input[name="trendView"]:checked')?.value || 'expense';
     renderTrendChart(data, selectedView);
     
     breakdownChart = renderDoughnutChart(
          breakdownChart, 
          'categoryBreakdownChart', 
          data.breakdownLabels, 
          data.breakdownData, 
          'breakdown-total', 
          'text-red-600', 
          chartColors,
          'breakdown-center-text' 
     );

     incomeChart = renderDoughnutChart(
          incomeChart, 
          'incomeBreakdownChart', 
          data.incomeLabels, 
          data.incomeData, 
          'income-breakdown-total', 
          'text-emerald-600', 
          incomeColors,
          'income-center-text' 
     );
}

function updateTrendChart() {
    const selectedValue = document.querySelector('input[name="trendView"]:checked').value;
    
    ['expense', 'income_expense', 'net_flow'].forEach(val => {
        const label = document.getElementById(`trend-${val}-label`);
        if (!label) return; 
        
        if (val === selectedValue) {
            label.classList.add('bg-blue-600', 'text-white');
            label.classList.remove('hover:bg-white/10', 'text-gray-700');
        } else {
            label.classList.remove('bg-blue-600', 'text-white');
            label.classList.add('hover:bg-white/10', 'text-gray-700');
        }
    });

    if (aggregatedData) { 
        renderTrendChart(aggregatedData, selectedValue);
    }
}

function aggregateData(allTransactions, period) {
     const transactionsWithTimestamp = allTransactions.filter(t => t.timestamp && typeof t.timestamp.seconds === 'number');
     const periodExpenses = new Map(); 
     const periodIncomes = new Map(); 
     const categoryExpenses = new Map(); 
     const categoryIncomes = new Map(); 
     const today = new Date();
     
     let timeWindowStart;
     let totalPeriods;
     let getLabel;
     let getKey;

     if (period === 'day') {
         totalPeriods = 7;
         timeWindowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (totalPeriods - 1));
         timeWindowStart.setHours(0, 0, 0, 0); 
         getKey = (date) => date.toLocaleDateString('en-US');
         getLabel = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
     } else if (period === 'week') {
         totalPeriods = 6;
         const startOfThisWeek = new Date(today);
         startOfThisWeek.setDate(today.getDate() - today.getDay());
         startOfThisWeek.setHours(0, 0, 0, 0);
         
         timeWindowStart = new Date(startOfThisWeek);
         timeWindowStart.setDate(startOfThisWeek.getDate() - (totalPeriods - 1) * 7);

         getKey = (date) => {
             const d = new Date(date);
             d.setDate(d.getDate() - d.getDay()); 
             return d.toLocaleDateString('en-US');
         };
         getLabel = (date) => {
             const d = new Date(date);
             d.setDate(d.getDate() - d.getDay()); 
             return 'Wk of ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
         };
     } else if (period === 'month') {
         totalPeriods = 6;
         timeWindowStart = new Date(today.getFullYear(), today.getMonth() - (totalPeriods - 1), 1);
         getKey = (date) => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
         getLabel = (date) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()] + ' ' + date.getFullYear().toString().slice(-2);
     } else if (period === 'year') {
         totalPeriods = 3;
         timeWindowStart = new Date(today.getFullYear() - (totalPeriods - 1), 0, 1);
         getKey = (date) => date.getFullYear().toString();
         getLabel = (date) => date.getFullYear().toString();
     } else {
         return aggregateData(allTransactions, 'month');
     }

     timeWindowStart.setHours(0, 0, 0, 0);


     transactionsWithTimestamp.forEach(t => {
         const date = new Date(t.timestamp.seconds * 1000);
         
         if (date >= timeWindowStart) {
             const key = getKey(date);
             const amount = Number(t.amount);
             const category = t.category || 'Uncategorized';

             if (t.type === 'expense') {
                 periodExpenses.set(key, (periodExpenses.get(key) || 0) + amount);
                 categoryExpenses.set(category, (categoryExpenses.get(category) || 0) + amount);
             } else if (t.type === 'income') {
                 periodIncomes.set(key, (periodIncomes.get(key) || 0) + amount);
                 categoryIncomes.set(category, (categoryIncomes.get(category) || 0) + amount); 
             }
         }
     });

     const trendLabels = [];
     const trendDataExpense = [];
     const trendDataIncome = [];
     const trendDataNetFlow = [];

     for (let i = 0; i < totalPeriods; i++) {
         let d = new Date(timeWindowStart);
         let key;
         let label;
         
         if (period === 'day') {
             d.setDate(timeWindowStart.getDate() + i);
         } else if (period === 'week') {
             d.setDate(timeWindowStart.getDate() + (i * 7));
         } else if (period === 'month') {
             d.setMonth(timeWindowStart.getMonth() + i);
         } else if (period === 'year') {
             d.setFullYear(timeWindowStart.getFullYear() + i);
         }

         key = getKey(d);
         label = getLabel(d);

         const expense = periodExpenses.get(key) || 0;
         const income = periodIncomes.get(key) || 0;
         
         trendLabels.push(label);
         trendDataExpense.push(expense);
         trendDataIncome.push(income);
         trendDataNetFlow.push(income - expense);
     }

     const breakdownLabels = Array.from(categoryExpenses.keys());
     const breakdownData = Array.from(categoryExpenses.values());

     const incomeLabels = Array.from(categoryIncomes.keys()); 
     const incomeData = Array.from(categoryIncomes.values()); 

     return { 
         trendLabels, 
         trendDataExpense, 
         trendDataIncome, 
         trendDataNetFlow, 
         breakdownLabels, 
         breakdownData,
         incomeLabels, 
         incomeData   
     };
}


// --- List View Functions ---

/**
 * Renders all transactions grouped by date for the full list view, including monthly and daily summaries.
 */
function renderAllTransactions() {
    const listElement = document.getElementById('grouped-transaction-list');
    listElement.innerHTML = '';

    // Get selected category filter
    const filterElement = document.getElementById('category-filter');
    const selectedCategory = filterElement ? filterElement.value : 'All';

    // 1. Filter transactions based on selection
    let filteredTransactions = transactions.filter(t => t.timestamp && typeof t.timestamp.seconds === 'number');
    
    if (selectedCategory !== 'All') {
        filteredTransactions = filteredTransactions.filter(t => t.category === selectedCategory);
    }
    
    if (filteredTransactions.length === 0) {
        listElement.innerHTML = `<p class="text-center text-gray-500 p-8">No transactions found for category: ${selectedCategory}.</p>`;
        return;
    }

    // 2. Sort, calculate flows, and group
    const sortedTransactions = [...filteredTransactions].sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
    const monthlyNetFlows = calculateMonthlyNetFlow(filteredTransactions); 
    const dailyNetFlows = calculateDailyNetFlow(filteredTransactions); 

    let lastMonthKey = null;

    // Group transactions by date key
    const groupedByDateKey = sortedTransactions.reduce((acc, t) => {
        const dateKey = formatDateKey(t.timestamp.seconds * 1000, true); 
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(t);
        return acc;
    }, {});

    
    // 3. Render groups and insert monthly/daily summaries
    for (const dateKey in groupedByDateKey) {
        const dayGroup = groupedByDateKey[dateKey];
        const firstTransactionDate = new Date(dayGroup[0].timestamp.seconds * 1000);
        const currentMonthKey = firstTransactionDate.getFullYear() + '-' + String(firstTransactionDate.getMonth() + 1).padStart(2, '0');

        // --- MONTHLY SUMMARY CHECK ---
        if (lastMonthKey !== currentMonthKey) {
            const netFlow = monthlyNetFlows.get(currentMonthKey) || 0;
            const isSurplus = netFlow >= 0;
            const flowClass = isSurplus ? 'text-emerald-600' : 'text-red-600';
            const flowSign = isSurplus ? 'Surplus' : 'Deficit';
            
            const monthName = firstTransactionDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

            const monthHeader = document.createElement('div');
            monthHeader.className = 'py-3 px-4 bg-blue-50/70 border-b border-blue-200 shadow-inner mb-2 flex justify-between items-center mt-6 rounded-xl';
            
            monthHeader.innerHTML = `
                <h4 class="text-base font-bold text-gray-800">Monthly Net Flow (${monthName})</h4>
                <div class="text-right">
                    <p class="text-xl font-extrabold ${flowClass}">${flowSign} ${formatCurrency(Math.abs(netFlow))}</p>
                </div>
            `;
            listElement.appendChild(monthHeader);
            lastMonthKey = currentMonthKey; 
        }
        
        // --- DAILY NET FLOW SUMMARY ---
        const dailyFlow = dailyNetFlows.get(dateKey) || 0;
        const isDailySurplus = dailyFlow >= 0;
        const dailyFlowClass = isDailySurplus ? 'text-emerald-600' : 'text-red-600';
        const dailyFlowSign = isDailySurplus ? 'Savings' : 'Deficit';
        const dateDisplay = formatDateKey(firstTransactionDate.getTime(), false);

        const dailyHeader = document.createElement('div');
        dailyHeader.className = 'py-2 px-4 bg-gray-100/70 rounded-lg flex justify-between items-center mt-3 border-l-4 border-gray-300';
        
        dailyHeader.innerHTML = `
            <h4 class="text-sm font-bold text-gray-800">${dateDisplay}</h4>
            <div class="text-right">
                <p class="text-xs font-semibold text-gray-600">Daily Net Flow (${dailyFlowSign})</p>
                <p class="text-lg font-extrabold ${dailyFlowClass}">${formatCurrency(Math.abs(dailyFlow))}</p>
            </div>
        `;
        listElement.appendChild(dailyHeader);


        // --- RENDER TRANSACTIONS ---
        const groupContainer = document.createElement('div');
        groupContainer.className = 'primary-card p-4 space-y-2';

        // Transactions for the day
        dayGroup.forEach(t => {
            groupContainer.appendChild(createTransactionElement(t, true));
        });

        listElement.appendChild(groupContainer);
    }
}

function calculateMonthlyNetFlow(allTransactions) {
     const monthlyFlow = new Map();
     allTransactions.forEach(t => {
         if (!t.timestamp || typeof t.timestamp.seconds !== 'number') return; 

         const date = new Date(t.timestamp.seconds * 1000);
         const yearMonthKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
         const amount = Number(t.amount);
         const flow = t.type === 'income' ? amount : -amount;
         
         monthlyFlow.set(yearMonthKey, (monthlyFlow.get(yearMonthKey) || 0) + flow);
     });
     return monthlyFlow;
}


function renderSummary() {
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
        const amount = parseFloat(t.amount);
        if (t.type === 'income') {
            totalIncome += amount;
        } else if (t.type === 'expense') {
            totalExpense += amount;
        }
    });

    const balance = totalIncome - totalExpense;
    const balanceElement = document.getElementById('balance');
    
    if (balance < 0) {
        balanceElement.classList.remove('text-white');
        balanceElement.classList.add('text-red-300');
        balanceElement.classList.remove('balance-glow');
    } else {
        balanceElement.classList.remove('text-red-300');
        balanceElement.classList.add('text-white');
        balanceElement.classList.add('balance-glow');
    }

    balanceElement.textContent = formatCurrency(balance);
    document.getElementById('income').textContent = formatCurrency(totalIncome);
    document.getElementById('expense').textContent = formatCurrency(totalExpense);
}

function renderRecentTransactions() {
    const listElement = document.getElementById('transaction-list-dashboard');
    listElement.innerHTML = ''; 

    if (transactions.length === 0) {
        listElement.innerHTML = '<p class="text-center text-gray-500 p-4">No transactions recorded yet. Add one using Quick Add!</p>';
        return;
    }

    const validTransactions = transactions.filter(t => t.timestamp && typeof t.timestamp.seconds === 'number');

    if (validTransactions.length === 0) {
         listElement.innerHTML = '<p class="text-center text-gray-500 p-4">No valid transactions to show.</p>';
        return;
    }

    // Sort transactions by timestamp (most recent first)
    const sortedTransactions = [...validTransactions].sort((a, b) => b.timestamp.seconds - a.timestamp.seconds);
    const dailyNetFlows = calculateDailyNetFlow(validTransactions); 

    const groupedByDateKey = sortedTransactions.reduce((acc, t) => {
        const dateKey = formatDateKey(t.timestamp.seconds * 1000, true);
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(t);
        return acc;
    }, {});

    let transactionCount = 0;
    let daysRendered = 0;
    const maxDays = 3; 
    const maxTransactions = 2; 

    for (const dateKey in groupedByDateKey) {
        if (daysRendered >= maxDays || transactionCount >= maxTransactions) break;

        const dayGroup = groupedByDateKey[dateKey];

        // 1. --- DAILY NET FLOW HEADER ---
        const dailyFlow = dailyNetFlows.get(dateKey) || 0;
        const isDailySurplus = dailyFlow >= 0;
        const dailyFlowClass = isDailySurplus ? 'text-emerald-600' : 'text-red-600';
        const dailyFlowSign = isDailySurplus ? 'Savings' : 'Deficit';
        const dateDisplay = formatDateKey(new Date(dayGroup[0].timestamp.seconds * 1000).getTime(), false);

        const dailyHeader = document.createElement('div');
        dailyHeader.className = 'py-2 px-3 bg-gray-100/70 rounded-lg flex justify-between items-center mt-3';
        dailyHeader.innerHTML = `
            <h4 class="text-sm font-bold text-gray-800">${dateDisplay}</h4>
            <div class="text-right">
                <p class="text-xs font-semibold text-gray-600">Net Flow (${dailyFlowSign})</p>
                <p class="text-base font-extrabold ${dailyFlowClass}">${formatCurrency(Math.abs(dailyFlow))}</p>
            </div>
        `;
        listElement.appendChild(dailyHeader);
        
        // 2. --- TRANSACTIONS (Limited to maxTransactions) ---
        for (const t of dayGroup) {
            if (transactionCount >= maxTransactions) break;
            listElement.appendChild(createTransactionElement(t));
            transactionCount++;
        }

        daysRendered++;
    }

    if (transactionCount === 0) {
         listElement.innerHTML = '<p class="text-center text-gray-500 p-4">No recent transactions to show.</p>';
    }
}

function calculateDailyNetFlow(allTransactions) {
    const dailyFlow = new Map();
    allTransactions.forEach(t => {
        if (!t.timestamp || typeof t.timestamp.seconds !== 'number') return; 

        const date = new Date(t.timestamp.seconds * 1000);
        const dateKey = date.toLocaleDateString('en-US'); 
        const amount = Number(t.amount);
        const flow = t.type === 'income' ? amount : -amount;
        
        dailyFlow.set(dateKey, (dailyFlow.get(dateKey) || 0) + flow);
    });
    return dailyFlow;
}

function formatDateKey(timestamp, isKey) {
    const now = new Date();
    const date = new Date(timestamp);
    
    const fullDateString = date.toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' });
    
    if (isKey) return fullDateString;

    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return "Today";
    if (isYesterday) return "Yesterday";

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function getIcon(type) {
    if (type === 'income') {
        return `<svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`;
    } else {
        return `<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`;
    }
}

function createTransactionElement(t, isFullList = false) {
    const isIncome = t.type === 'income';
    const sign = isIncome ? '+' : '-' ;
    const amountClass = isIncome ? 'income-text' : 'expense-text';
    
    const date = new Date(t.timestamp?.seconds * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const category = t.category || 'N/A';
    const isRecurring = !!t.recurringId; 

    const listItem = document.createElement('div');
    listItem.className = `transaction-item flex justify-between items-center ${isFullList ? 'py-2' : 'p-3'} hover:bg-gray-50 rounded-lg transition duration-100 ease-in-out`;
    listItem.dataset.docId = t.id;

    listItem.innerHTML = `
        <div class="flex items-center space-x-4 flex-1 min-w-0">
            <div class="p-2 rounded-full ${isIncome ? 'bg-emerald-100' : 'bg-red-100'}">
                ${getIcon(t.type)}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-gray-900 font-semibold truncate">${t.description}</p>
                <div class="flex items-center space-x-2 text-gray-500 text-sm">
                    <span>${category}</span>
                    <span class="text-xs text-gray-400">· ${date}</span>
                    ${isRecurring ? '<span class="text-xs text-blue-500 font-bold ml-1">· RECURRING</span>' : ''}
                </div>
            </div>
        </div>
        <div class="flex items-center space-x-3">
            <span class="text-lg font-bold ${amountClass} text-right">
                ${sign}${formatCurrency(t.amount)}
            </span>
            <button class="delete-btn text-gray-400 hover:text-red-500 transition-colors duration-150 p-1 rounded"
                    data-doc-id="${t.id}" title="Delete Transaction">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        </div>
    `;
    
    listItem.querySelector('.delete-btn').addEventListener('click', (e) => {
        const docId = e.currentTarget.dataset.docId;
        if (docId) {
            deleteTransaction(docId);
        }
    });

    return listItem;
}

function updateTypeSelector(radio) {
    const expenseLabel = document.getElementById('type-expense-label');
    const incomeLabel = document.getElementById('type-income-label');
    const isExpense = radio.value === 'expense';

    if (isExpense) {
        expenseLabel.classList.add('bg-red-600', 'text-white', 'shadow-lg', 'shadow-red-500/30');
        incomeLabel.classList.remove('bg-green-600', 'text-white', 'shadow-lg', 'shadow-green-500/30');
        incomeLabel.classList.add('text-gray-700', 'hover:bg-white', 'shadow-none');
    } else {
        incomeLabel.classList.add('bg-green-600', 'text-white', 'shadow-lg', 'shadow-green-500/30');
        expenseLabel.classList.remove('bg-red-600', 'text-white', 'shadow-lg', 'shadow-red-500/30');
        expenseLabel.classList.add('text-gray-700', 'hover:bg-white', 'shadow-none');
    }
}

function updateBudgetPeriod(period) {
    currentBudgetPeriod = period;

    ['Daily', 'Monthly', 'Yearly'].forEach(val => {
        const label = document.getElementById(`budget-period-${val.toLowerCase()}`);
        if (!label) return; 
        
        if (val === period) {
            label.classList.add('bg-blue-600', 'text-white');
            label.classList.remove('hover:bg-white/10', 'text-gray-700');
        } else {
            label.classList.remove('bg-blue-600', 'text-white');
            label.classList.add('hover:bg-white/10', 'text-gray-700');
        }
    });
    
    document.getElementById('budget-period-label').textContent = period;
    
    const selectedCategory = document.getElementById('budget-category').value;
    loadBudgetForEdit(selectedCategory);

    renderBudgetSettings(); 
}

// --- Core Functions (Exposed) ---

function showView(viewName) {
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('analytics-view').classList.add('hidden');
    document.getElementById('full-list-view').classList.add('hidden'); 
    document.getElementById('budget-settings-view').classList.add('hidden');
    document.getElementById('import-transactions-view').classList.add('hidden'); 
    document.getElementById('recurring-transactions-view').classList.add('hidden'); 
    document.getElementById('savings-goals-view').classList.add('hidden'); 

    // Reset navigation bar colors
    const navButtons = ['nav-dashboard', 'nav-analytics', 'nav-recurring', 'nav-goals'];
    navButtons.forEach(id => {
         const btn = document.getElementById(id);
         if (btn) {
             btn.classList.remove('nav-button-active', 'text-gray-500');
             btn.classList.add('text-gray-500');
         }
    });


    if (viewName === 'dashboard') {
        document.getElementById('dashboard-view').classList.remove('hidden');
        document.getElementById('nav-dashboard').classList.add('nav-button-active');
    } else if (viewName === 'analytics') {
        document.getElementById('analytics-view').classList.remove('hidden');
        document.getElementById('nav-analytics').classList.add('nav-button-active');
        
        // Re-calculate and render charts upon entering analytics view
        aggregatedData = aggregateData(transactions, currentPeriod); 
        renderCharts(aggregatedData);
    } else if (viewName === 'list') {
        document.getElementById('full-list-view').classList.remove('hidden');
        renderAllTransactions(); 
    } else if (viewName === 'budget-settings') {
        document.getElementById('budget-settings-view').classList.remove('hidden');
        renderBudgetSettings();
    } else if (viewName === 'import-transactions') {
        document.getElementById('import-transactions-view').classList.remove('hidden');
    } else if (viewName === 'recurring') {
        document.getElementById('recurring-transactions-view').classList.remove('hidden');
        document.getElementById('nav-recurring').classList.add('nav-button-active');
        renderRecurringTransactions();
    } else if (viewName === 'goals') {
        document.getElementById('savings-goals-view').classList.remove('hidden');
        document.getElementById('nav-goals').classList.add('nav-button-active');
        renderGoalsProgress();
    }
}

function updateAnalyticsPeriod(period) {
    currentPeriod = period;

    // 1. Update the time period buttons' visual state
    ['day', 'week', 'month', 'year'].forEach(val => {
        const label = document.getElementById(`period-${val}-label`);
        if (!label) return; 
        
        if (val === period) {
            label.classList.add('bg-blue-600', 'text-white');
            label.classList.remove('hover:bg-white/10', 'text-gray-700');
        } else {
            label.classList.remove('bg-blue-600', 'text-white');
            label.classList.add('hover:bg-white/10', 'text-gray-700');
        }
    });

    // 2. Reset the trend view to 'Expense Only' and update its visuals
    const expenseRadio = document.querySelector('input[name="trendView"][value="expense"]');
    
    if (expenseRadio) {
        expenseRadio.checked = true;
        updateTrendChart(); 
    }

    // 3. Process new data
    if (transactions.length > 0) {
         aggregatedData = aggregateData(transactions, currentPeriod); 
         renderCharts(aggregatedData);
    }
}

// --- Window Load Initialization ---
function initializeApp() {
    // Initial styling for analytics selectors
    updateAnalyticsPeriod('month');
    
    // Initial styling for transaction type selector
    document.querySelector('input[name="transactionType"][value="expense"]').checked = true;
    updateTypeSelector(document.querySelector('input[name="transactionType"][value="expense"]'));
    
    // Initial styling for budget period selector
    document.querySelector('input[name="budgetPeriod"][value="Monthly"]').checked = true;
    updateBudgetPeriod('Monthly');
    
    // Initial recurring view setup
    document.querySelector('input[name="recurringType"][value="expense"]').checked = true;
    toggleRecurringDayInput(document.getElementById('recurring-frequency').value);


    // Initial styling for navigation
    document.getElementById('nav-dashboard').classList.add('nav-button-active');
    document.getElementById('nav-analytics').classList.remove('nav-button-active');
    document.getElementById('nav-recurring').classList.remove('nav-button-active');
    document.getElementById('nav-goals').classList.remove('nav-button-active');


    showView('dashboard'); 
    initLocalData();
}

// --- Attach Initialization to Window Load ---
window.onload = initializeApp;

// --- Expose functions globally for inline HTML (onclick) calls ---
window.showView = showView;
window.updateTrendChart = updateTrendChart;
window.updateAnalyticsPeriod = updateAnalyticsPeriod; 
window.updateTypeSelector = updateTypeSelector; 
window.renderAllTransactions = renderAllTransactions; 
window.saveBudgets = saveBudgets; 
window.loadBudgetForEdit = loadBudgetForEdit; 
window.updateBudgetPeriod = updateBudgetPeriod; 
window.renderBudgetSettings = renderBudgetSettings; 
window.closeBudgetWarning = closeBudgetWarning; 
window.toggleRecurringDayInput = toggleRecurringDayInput;
window.renderGoalsProgress = renderGoalsProgress; 
window.depositToGoal = depositToGoal; 
window.editRecurring = editRecurring; 
window.editGoal = editGoal;
window.withdrawFromGoal = withdrawFromGoal; 

// --- Event Listeners and Main Execution ---

document.getElementById('transaction-form').addEventListener('submit', (e) => {
    e.preventDefault();

    // Get value from the radio button group
    const type = document.querySelector('input[name="transactionType"]:checked').value; 
    
    const description = document.getElementById('description').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const dateString = document.getElementById('date').value;
    const timeString = document.getElementById('time').value; 

    if (description && !isNaN(amount) && amount > 0) {
        const newTransaction = {
            description: description,
            amount: amount,
            type: type, 
            category: category,
            dateString: dateString,
            timeString: timeString 
        };
        addTransaction(newTransaction);

        // Reset form inputs
        document.getElementById('description').value = '';
        document.getElementById('amount').value = '';
        document.getElementById('category').value = 'Uncategorized';
        
        // Reset date to today's date after submission
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        document.getElementById('date').value = `${yyyy}-${mm}-${dd}`;
        document.getElementById('time').value = ''; 

        // Reset type selector to default (Expense)
        document.querySelector('input[name="transactionType"][value="expense"]').checked = true;
        updateTypeSelector(document.querySelector('input[name="transactionType"][value="expense"]'));

    } else {
        showMessage("Please enter valid description and amount (> 0).", 'error');
    }
});

// --- Goal Form Submission (UPDATED) ---
document.getElementById('goal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('goal-name').value.trim();
    const targetAmount = parseFloat(document.getElementById('goal-target-amount').value);
    const targetDate = document.getElementById('goal-target-date').value;
    const editId = e.currentTarget.querySelector('button[type="submit"]').dataset.editId;

    if (name && !isNaN(targetAmount) && targetAmount > 0) {
        
        if (editId) {
            // Update existing goal
            const index = goals.findIndex(g => g.id === editId);
            if (index !== -1) {
                 goals[index].name = name;
                 goals[index].targetAmount = targetAmount;
                 goals[index].targetDate = targetDate || null;
                 showMessage(`Goal "${name}" updated successfully!`, 'success');
            }
        } else {
            // Create new goal
            const newGoal = {
                id: generateId(),
                name: name,
                targetAmount: targetAmount,
                currentAmount: 0,
                targetDate: targetDate || null,
                createdAt: Date.now()
            };
            goals.push(newGoal);
            showMessage(`Goal "${name}" set! Start depositing now.`, 'success');
        }
        
        saveGoals();
        
        // Reset form state
        document.getElementById('goal-form').reset();
        const submitBtn = document.querySelector('#goal-form button[type="submit"]');
        submitBtn.textContent = 'SET GOAL';
        delete submitBtn.dataset.editId;

    } else {
        showMessage("Please enter a valid goal name and target amount.", 'error');
    }
});
// --- End Goal Form Submission ---

// --- Budget Form Submission (Unchanged) ---
document.getElementById('budget-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const category = document.getElementById('budget-category').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);
    // Get the currently selected period from the radio buttons
    const period = document.querySelector('input[name="budgetPeriod"]:checked').value; 

    if (category && !isNaN(amount) && amount >= 0) {
        // Initialize category object if it's doesn't exist
        budgets[category] = budgets[category] || {};
        // Set the budget for the specific period
        budgets[category][period] = amount;
        saveBudgets();
        
        // Reset form
        document.getElementById('budget-amount').value = '';
        
        showMessage(`Budget of ${formatCurrency(amount)} set for ${category} (${period}).`);
    } else {
        showMessage("Please enter a valid category and a non-negative amount.", 'error');
    }
});
// --- End Budget Form Submission ---

// --- Import Form Submission (Unchanged) ---
document.getElementById('import-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const importData = document.getElementById('import-data').value.trim();
    const lines = importData.split('\n').filter(line => line.trim() !== '');
    let importedCount = 0;
    
    lines.forEach(line => {
        // Expects: AMOUNT, Description, Category (comma-separated)
        const parts = line.split(',').map(p => p.trim());
        
        if (parts.length >= 3) {
            const amountRaw = parts[0];
            const amount = parseFloat(amountRaw);
            const description = parts[1] || 'Imported Transaction';
            const category = parts[2] || 'Uncategorized';
            
            if (!isNaN(amount) && amount !== 0) {
                // Determine type: Negative amount = Expense, Positive amount = Income
                const type = amount < 0 ? 'expense' : 'income';
                
                // Check if the category is valid for the determined type
                let finalCategory = category;
                if (type === 'expense' && !EXPENSE_CATEGORIES.includes(category)) {
                    finalCategory = 'Uncategorized';
                } else if (type === 'income' && !ALL_CATEGORIES.includes(category)) {
                    finalCategory = 'Salary (Income)';
                }
                
                addImportedTransaction(description, amount, finalCategory, type);
                importedCount++;
            }
        }
    });
    
    if (importedCount > 0) {
        document.getElementById('import-data').value = '';
        saveTransactions();
        showMessage(`${importedCount} transactions imported successfully!`);
        showView('dashboard'); 
    } else {
         showMessage("No valid transactions found in the pasted data.", 'error');
    }
});
// --- End Import Form Submission ---

// --- Recurring Form Submission (UPDATED) ---
document.getElementById('recurring-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const type = document.querySelector('input[name="recurringType"]:checked').value;
    const description = document.getElementById('recurring-description').value.trim();
    const amount = parseFloat(document.getElementById('recurring-amount').value);
    const category = document.getElementById('recurring-category').value;
    const frequency = document.getElementById('recurring-frequency').value;
    const editId = e.currentTarget.querySelector('button[type="submit"]').dataset.editId;
    
    let day = 1; 
    if (frequency === 'Monthly' || frequency === 'Yearly') {
        day = parseInt(document.getElementById('recurring-day-of-month').value, 10) || 1;
        day = Math.max(1, Math.min(28, day));
    } else if (frequency === 'Weekly') {
        day = parseInt(document.getElementById('recurring-day-of-week').value, 10) || 0;
    }

    if (description && !isNaN(amount) && amount > 0) {
        const newRuleData = {
             id: editId || generateId(),
             description,
             amount: amount,
             type,
             category,
             frequency,
             day, 
             createdAt: Date.now(),
             lastGenerated: null 
        };
        
        if (editId) {
             // Update existing rule
             const index = recurringTransactions.findIndex(r => r.id === editId);
             if (index !== -1) {
                 newRuleData.createdAt = recurringTransactions[index].createdAt;
                 newRuleData.lastGenerated = recurringTransactions[index].lastGenerated;
                 recurringTransactions[index] = newRuleData;
                 showMessage(`Recurring rule for ${description} updated.`, 'success');
             }
        } else {
            // Create new rule
            recurringTransactions.push(newRuleData);
            showMessage(`Recurring rule for ${description} saved. Transactions will generate automatically.`, 'success');
        }

        saveRecurringTransactions();
        
        // Reset form state
        document.getElementById('recurring-form').reset();
        document.getElementById('recurring-day-of-month').value = '1';
        const submitBtn = document.querySelector('#recurring-form button[type="submit"]');
        submitBtn.textContent = 'SAVE RECURRING RULE';
        delete submitBtn.dataset.editId;
        
    } else {
         showMessage("Please enter valid description, amount (> 0), and frequency settings.", 'error');
    }
});
// --- End Recurring Form Submission ---