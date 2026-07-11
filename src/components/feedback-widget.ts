/**
 * Floating feedback widget rendered entirely inside a shadow root.
 * Practices shadow-DOM piercing (e.g. Playwright pierces automatically,
 * Selenium needs getShadowRoot()). Deliberately no data-testid inside.
 */
class FeedbackWidget extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { position: fixed; bottom: 20px; right: 20px; z-index: 900; font-family: inherit; }
        #fab {
          background: #4f46e5; color: #fff; border: none; border-radius: 24px;
          padding: 10px 18px; font-size: 14px; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.25);
        }
        #panel {
          position: absolute; bottom: 52px; right: 0; width: 280px; background: #fff; color: #1f2937;
          border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.2);
        }
        #panel h4 { margin: 0 0 10px; font-size: 15px; }
        .stars { display: flex; gap: 4px; margin-bottom: 10px; }
        .star { font-size: 22px; cursor: pointer; color: #d1d5db; background: none; border: none; padding: 0; }
        .star.on { color: #f59e0b; }
        textarea {
          width: 100%; box-sizing: border-box; height: 70px; resize: none; font-family: inherit;
          border: 1px solid #d1d5db; border-radius: 8px; padding: 8px; font-size: 13px;
        }
        #submit {
          margin-top: 10px; width: 100%; background: #4f46e5; color: #fff; border: none;
          border-radius: 8px; padding: 8px; font-size: 14px; cursor: pointer;
        }
        #submit:disabled { opacity: .5; cursor: not-allowed; }
        #thanks { color: #059669; font-size: 14px; margin: 8px 0 0; }
        [hidden] { display: none !important; }
      </style>
      <div id="panel" hidden>
        <h4>How are we doing?</h4>
        <div class="stars">
          ${[1, 2, 3, 4, 5].map((n) => `<button class="star" data-value="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}
        </div>
        <textarea id="comment" placeholder="Tell us more (optional)"></textarea>
        <button id="submit" disabled>Submit feedback</button>
        <p id="thanks" hidden>Thanks for your feedback!</p>
      </div>
      <button id="fab" aria-label="Open feedback widget">💬 Feedback</button>
    `;

    const panel = root.getElementById('panel') as HTMLElement;
    const fab = root.getElementById('fab') as HTMLButtonElement;
    const submit = root.getElementById('submit') as HTMLButtonElement;
    const thanks = root.getElementById('thanks') as HTMLElement;
    const comment = root.getElementById('comment') as HTMLTextAreaElement;
    let rating = 0;

    fab.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
    });

    root.querySelectorAll<HTMLButtonElement>('.star').forEach((star) => {
      star.addEventListener('click', () => {
        rating = Number(star.dataset.value);
        root.querySelectorAll<HTMLButtonElement>('.star').forEach((s) => {
          s.classList.toggle('on', Number(s.dataset.value) <= rating);
        });
        submit.disabled = false;
        thanks.hidden = true;
      });
    });

    submit.addEventListener('click', () => {
      thanks.hidden = false;
      submit.disabled = true;
      comment.value = '';
      rating = 0;
      root.querySelectorAll('.star').forEach((s) => s.classList.remove('on'));
      setTimeout(() => {
        panel.hidden = true;
        thanks.hidden = true;
      }, 2500);
    });
  }
}

if (!customElements.get('feedback-widget')) {
  customElements.define('feedback-widget', FeedbackWidget);
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'feedback-widget': Record<string, unknown>;
    }
  }
}

export {};
