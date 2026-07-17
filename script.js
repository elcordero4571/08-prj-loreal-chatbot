/* -----------------------------------------
   1. Connect to the HTML elements
----------------------------------------- */

const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const sendBtn = document.getElementById("sendBtn");

/*
  These elements are included in the updated HTML.

  The question mark allows the chatbot to keep working even if
  you have not added these optional elements yet.
*/
const latestQuestionBox = document.getElementById("latestQuestionBox");
const latestQuestionText = document.getElementById("latestQuestionText");
const statusMessage = document.getElementById("statusMessage");


/* -----------------------------------------
   2. Add your Cloudflare Worker URL
----------------------------------------- */

/*
  Replace this example URL with your deployed Cloudflare Worker URL.

  This is only a web address. It is not an API key.

  Never put an OpenAI API key inside this file.
*/
const WORKER_URL =
  "https://loreal-chat-bot.elcordero4571.workers.dev";


/* -----------------------------------------
   3. Create the chatbot's system prompt
----------------------------------------- */

/*
  The system prompt explains the chatbot's job and rules.

  It is added as the first message in the conversation.
*/
const systemPrompt = `
You are the L'Oréal Beauty Assistant.

Your job is to help users discover and understand L'Oréal makeup,
skincare, haircare, fragrances, products, and personalized beauty routines.

Follow these rules:

1. Answer questions about L'Oréal products and general beauty topics.
2. Help users build simple skincare, makeup, haircare, and fragrance routines.
3. Ask helpful follow-up questions when needed, such as:
   - What is your skin type?
   - What is your hair type?
   - What result are you hoping for?
   - Do you have any sensitivities?
   - What is your budget?
4. Keep answers friendly, clear, and easy for beginners to understand.
5. Do not invent ingredients, prices, product availability, or medical claims.
6. When exact product information is needed, tell the user to check the
   product packaging or the official L'Oréal website.
7. Do not diagnose medical conditions.
8. For serious irritation, allergic reactions, or medical concerns,
   recommend contacting a qualified healthcare professional.
9. If the user asks something unrelated to L'Oréal or beauty, politely say:
   "I'm here to help with L'Oréal products and beauty routines.
   What beauty question can I help you with?"
`.trim();


/* -----------------------------------------
   4. Store the conversation history
----------------------------------------- */

/*
  This array remembers the conversation.

  Every user question and assistant answer will be added to it.
  Sending the array with every request allows the chatbot to remember
  details such as the user's name, skin type, or previous questions.
*/
const conversationHistory = [
  {
    role: "system",
    content: systemPrompt,
  },
];


/* -----------------------------------------
   5. Create a message bubble
----------------------------------------- */

/*
  role will be either:
  - "user"
  - "assistant"

  text is the message displayed inside the bubble.
*/
function addMessage(role, text) {
  // Create the outside message bubble.
  const messageBubble = document.createElement("div");

  // Template literals combine the basic class with the role class.
  messageBubble.className = `message ${role}-message`;

  // Create a small label for the speaker.
  const messageLabel = document.createElement("p");
  messageLabel.className = "message-label";

  if (role === "user") {
    messageLabel.textContent = "You";
  } else {
    messageLabel.textContent = "L'Oréal Assistant";
  }

  // Create the paragraph containing the actual message.
  const messageText = document.createElement("p");
  messageText.className = "message-text";

  /*
    textContent displays the response as plain text.

    This is safer than putting an AI response directly into innerHTML.
  */
  messageText.textContent = text;

  // Put the label and message inside the bubble.
  messageBubble.appendChild(messageLabel);
  messageBubble.appendChild(messageText);

  // Place the completed bubble inside the chat window.
  chatWindow.appendChild(messageBubble);

  // Automatically scroll to the newest message.
  chatWindow.scrollTop = chatWindow.scrollHeight;

  // Return the bubble in case JavaScript needs to remove it later.
  return messageBubble;
}


/* -----------------------------------------
   6. Display the welcome message
----------------------------------------- */

// Clear any starter text that may already be inside the chat window.
chatWindow.textContent = "";

// Add an assistant welcome bubble.
addMessage(
  "assistant",
  "👋 Hello! I’m your L'Oréal Beauty Assistant. I can help with makeup, skincare, haircare, fragrances, and personalized beauty routines. What would you like help with today?",
);


/* -----------------------------------------
   7. Listen for the form submission
----------------------------------------- */

chatForm.addEventListener("submit", sendMessage);


/* -----------------------------------------
   8. Send the user's message
----------------------------------------- */

async function sendMessage(event) {
  // Prevent the form from refreshing the webpage.
  event.preventDefault();

  // Read the user's question and remove extra spaces.
  const question = userInput.value.trim();

  // Stop if the input contains no text.
  if (question === "") {
    return;
  }

  /*
    Extra-credit feature:
    Show the user's newest question above the chat response.
  */
  if (latestQuestionBox && latestQuestionText) {
    latestQuestionBox.hidden = false;
    latestQuestionText.textContent = question;
  }

  // Display the user's message in the conversation.
  addMessage("user", question);

  // Add the question to the conversation history.
  conversationHistory.push({
    role: "user",
    content: question,
  });

  // Clear the input field.
  userInput.value = "";

  // Disable the form while waiting for the response.
  userInput.disabled = true;
  sendBtn.disabled = true;

  // Display a loading status if the status element exists.
  if (statusMessage) {
    statusMessage.textContent = "The assistant is thinking...";
  }

  // Add a temporary Thinking message to the chat.
  const thinkingBubble = addMessage(
    "assistant",
    "Thinking...",
  );

  try {
    /*
      Send the conversation to the Cloudflare Worker.

      No API key is needed here. The Worker handles the secure
      communication with OpenAI.
    */
    const response = await fetch(WORKER_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        messages: conversationHistory,
      }),
    });

    /*
      Convert the response into a JavaScript object.

      We do this before checking response.ok because an error response
      may contain useful information.
    */
    const data = await response.json();

    // Check whether the Worker or OpenAI returned an error.
    if (!response.ok) {
      const errorMessage =
        data.error?.message ||
        `The request failed with status ${response.status}.`;

      throw new Error(errorMessage);
    }

    /*
      OpenAI's Chat Completions response places the answer here:

      data.choices[0].message.content
    */
    const assistantReply =
      data.choices?.[0]?.message?.content;

    // Make sure an answer was included.
    if (!assistantReply) {
      throw new Error(
        "The chatbot response did not contain a message.",
      );
    }

    // Remove the temporary Thinking bubble.
    thinkingBubble.remove();

    // Display the assistant's answer.
    addMessage("assistant", assistantReply);

    // Save the answer in the conversation history.
    conversationHistory.push({
      role: "assistant",
      content: assistantReply,
    });

    // Clear the loading status.
    if (statusMessage) {
      statusMessage.textContent = "";
    }
  } catch (error) {
    // Remove the Thinking bubble after an error.
    thinkingBubble.remove();

    // Display a friendly message to the user.
    addMessage(
      "assistant",
      "Sorry, I could not connect to the beauty assistant. Please check the Cloudflare Worker URL and try again.",
    );

    // Show more information in the status area.
    if (statusMessage) {
      statusMessage.textContent =
        `Error: ${error.message}`;
    }

    // Show the complete error in the browser console.
    console.error("Chatbot error:", error);
  } finally {
    /*
      This section always runs, whether the request succeeds or fails.

      It turns the input and button back on.
    */
    userInput.disabled = false;
    sendBtn.disabled = false;

    // Place the typing cursor back in the input.
    userInput.focus();
  }
}