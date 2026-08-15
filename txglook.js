/* Data Structures */
const tangraphScores = {}; // Will be populated from external source

/* DOM Elements */
const elements = {
  output: document.getElementById('output'),
  rolloverInfo: document.getElementById('rollover-info'),
  resultList: document.getElementById('result-list'),
  strokeEntryField: document.getElementById('stroke-entry-field'),
  strokeBeginsWith: document.getElementById('stroke-begins-with'),
  strokeEndsWith: document.getElementById('stroke-ends-with')
};

/* State */
let results = [];

/* jQuery initializations */
$(() => {
  $('.toggler').on('click', function() {
    $(this).next('div').slideToggle();
    const isPlus = $(this).hasClass('glyphicon-plus-sign');
    $(this)
      .toggleClass('glyphicon-plus-sign', !isPlus)
      .toggleClass('glyphicon-minus-sign', isPlus);
  });
});

/**
 * Switch writing mode between LTR and TTB
 * @param {string} mode - The writing mode to switch to
 */
function switchWritingMode(mode) {
  if (!elements.output) return;
  elements.output.style['writing-mode'] = mode;
}

/**
 * Update rollover information text
 * @param {string} tangraph - The tangraph character
 */
function rolloverResult(tangraph) {
  if (!elements.rolloverInfo || !tangraphInfo[tangraph]) return;
  elements.rolloverInfo.textContent = `${tangraph} ${tangraphInfo[tangraph]?.[3] || ''}`;
}

/**
 * Update list of result tangraphs on page
 * @param {number} maxChars - Maximum number of characters to display
 */
function updatePageResults(maxChars = 80) {
  if (!elements.resultList) return;
  
  const resultItems = results
    .slice(0, maxChars)
    .map(tangraph => `
      <li class="results-item" 
          onmouseover="rolloverResult('${tangraph}');" 
          onclick="insertAtCursor('output', '${tangraph}');">
        ${tangraph}
      </li>
    `)
    .join('');
    
  elements.resultList.innerHTML = resultItems;
}
/**
 * Insert character at cursor position
 * @param {string} elementId - Target element ID
 * @param {string} char - Character to insert
 */
function insertAtCursor(elementId, char) {
  const output = document.getElementById(elementId);
  if (!output) return;
  
  if (output.selectionStart || output.selectionStart === 0) {
    const startPos = output.selectionStart;
    const endPos = output.selectionEnd;
    output.value = 
      output.value.substring(0, startPos) +
      char +
      output.value.substring(endPos);
  } else {
    output.value += char;
  }
}
/**
 * Safe check for tangraph data
 * @returns {boolean} Whether the required data is available
 */
function isDataAvailable() {
  return typeof tangraphInfo === 'object' && 
         typeof tangraphScores === 'object' &&
         Object.keys(tangraphInfo).length > 0;
}
/**
 * Update results list based on current filters
 */
function updateResultsList() {
  if (!isDataAvailable()) {
    console.warn('Tangraph data not yet available');
    return;
  }

  const strokeValue = elements.strokeEntryField?.value || '';
  // if code value length is less than 3, then do nothing.
  const isUnder4Digits = !!strokeValue && (/^\d{1,3}$/.test(strokeValue));

  if (!strokeValue || isUnder4Digits) {
    // Default sorting by score when no input
    results = Object.keys(tangraphInfo)
      .filter(key => tangraphScores[key] > 0)
      .sort((a, b) => (tangraphScores[b] || 0) - (tangraphScores[a] || 0));
    updatePageResults();
    return;
  }

  // Build regex pattern
  let strokesRegex = strokeValue.replace('*', '.*');
  if (elements.strokeBeginsWith?.checked) strokesRegex = `^${strokesRegex}`;
  if (elements.strokeEndsWith?.checked) strokesRegex += '$';
  
  // specail code patterns (LFW code or Four Corner code)
  const isValidFourCode = strokeValue.length >= 4 && /^\d+$/.test(strokeValue);
  const isLFWCode = strokeValue.length === 5 && strokeValue.startsWith("L");
  const isSpecialCode = isValidFourCode || isLFWCode;
  
  const startsWithSeq = [];
  const containsSeq = [];
  
  try {
    const pattern = new RegExp(strokesRegex);
    const startPattern = new RegExp(`^${strokesRegex}`);
    
    let logCount = 0; 
    Object.entries(tangraphInfo).forEach(([tangraph, info]) => {
      // - If the input code (=strokeValue) is a valid LFW code or 4+ digit's Four Corner 
      //   code, search for the corresponding character from info[3] using them as keys.
      // - Otherwise, treat it as an existing radical code, and 
      //   search for the corresponding character from info[2] based on that radical. 
      if (isSpecialCode) {
          const strokeSeq = info[3];
          const codes = strokeSeq.split(/\s+/);
          const isMatch = codes.some(code => startPattern.test(code));
          if (isMatch) {
            startsWithSeq.push(tangraph);
          }
      } else {
        const strokeSeq = info[2];
        if (startPattern.test(strokeSeq)) {
          startsWithSeq.push(tangraph);
        } else if (pattern.test(strokeSeq)) {
          containsSeq.push(tangraph);
        }
      }
    });

    results = [...startsWithSeq, ...containsSeq];
    updatePageResults();
  } catch (error) {
    console.error('Invalid regex pattern:', error);
    results = [];
    updatePageResults();
  }
}

/**
 * Toggle checkbox state and update results
 * @param {string} id - Checkbox element ID
 */
function toggleCheckbox(id) {
  const checkbox = document.getElementById(id);
  if (checkbox) {
    checkbox.checked = !checkbox.checked;
    updateStrokeEntry();
  }
}
/**
 * Insert stroke and update results
 * @param {string} stroke - Stroke to insert
 */
function insertStroke(stroke) {
  if (!elements.strokeEntryField) return;
  elements.strokeEntryField.value += stroke;
  updateStrokeEntry();
}

/**
 * Update stroke entry field and results
 */
function updateStrokeEntry() {
  if (!elements.strokeEntryField) return;
  
  let val = elements.strokeEntryField.value.toUpperCase();

  // If the first character is a digit, remove all alphabetic characters.
  if (/^[0-9]/.test(val)) {
    val = val.replace(/[A-Z]/g, '');
  }

  // Allow A-Q, numbers, '.', '*', and 'L'
  val = val.replace(/[^A-Q0-9.*L]/g, '');

  // Allow 'L0000-L9999' (including typing states like L1, L12...), 
  // but disallow other combinations of alphabets and numbers.
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) {
    if (!/^L\d{0,4}$/.test(val)) {
      val = val.replace(/[0-9]/g, '');
    }
  }

  // Apply the ones that passed the check, then search for the corresponding 
  // character using it and reflect it on the screen.
  elements.strokeEntryField.value = val;
  updateResultsList();
}

/**
 * Clear stroke entry field and update results
 */
function clearStrokeEntryField() {
  if (!elements.strokeEntryField) return;
  elements.strokeEntryField.value = '';
  updateResultsList();
}

/**
 * Initialize application
 */
function init() {
  // Add event listeners only if elements exist
  if (elements.strokeEntryField) {
    elements.strokeEntryField.addEventListener('keyup', updateStrokeEntry);
  }
  
  if (elements.strokeBeginsWith) {
    elements.strokeBeginsWith.addEventListener('change', updateStrokeEntry);
  }
  
  if (elements.strokeEndsWith) {
    elements.strokeEndsWith.addEventListener('change', updateStrokeEntry);
  }

  // Wait for data to be available before initial update
  if (isDataAvailable()) {
    updateResultsList();
  } else {
    console.warn('Waiting for tangraph data to be loaded...');
  }
}

/* Initialize application when DOM is ready */
$(init);