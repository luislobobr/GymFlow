/**
 * MFIT Personal - Timer Module
 * Rest timer with audio alerts and vibration
 */

class Timer {
    constructor() {
        this.duration = 60; // Default 60 seconds
        this.remaining = 0;
        this.isRunning = false;
        this.intervalId = null;
        this.onTick = null;
        this.onComplete = null;
        this.audioContext = null;
    }

    /**
     * Start the timer
     * @param {number} seconds - Duration in seconds
     * @param {object} callbacks - { onTick, onComplete }
     */
    start(seconds, callbacks = {}) {
        this.stop(); // Stop any existing timer

        this.duration = seconds || this.duration;
        this.remaining = this.duration;
        this.isRunning = true;
        this.onTick = callbacks.onTick || null;
        this.onComplete = callbacks.onComplete || null;

        // Emit initial tick
        if (this.onTick) {
            this.onTick(this.remaining, this.getProgress());
        }

        this.intervalId = setInterval(() => {
            this.remaining--;

            if (this.onTick) {
                this.onTick(this.remaining, this.getProgress());
            }

            if (this.remaining <= 0) {
                this.complete();
            }
        }, 1000);

        return this;
    }

    /**
     * Stop the timer
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        return this;
    }

    /**
     * Pause the timer
     */
    pause() {
        this.stop();
        return this;
    }

    /**
     * Resume the timer
     */
    resume() {
        if (!this.isRunning && this.remaining > 0) {
            this.start(this.remaining, {
                onTick: this.onTick,
                onComplete: this.onComplete
            });
        }
        return this;
    }

    /**
     * Reset the timer
     */
    reset() {
        this.stop();
        this.remaining = this.duration;
        if (this.onTick) {
            this.onTick(this.remaining, this.getProgress());
        }
        return this;
    }

    /**
     * Add time to the timer
     */
    addTime(seconds) {
        this.remaining += seconds;
        if (this.onTick) {
            this.onTick(this.remaining, this.getProgress());
        }
        return this;
    }

    /**
     * Timer complete
     */
    complete() {
        this.stop();
        this.remaining = 0;

        // Play completion sound
        this.playBeep();

        // Vibrate if supported
        this.vibrate();

        if (this.onComplete) {
            this.onComplete();
        }
    }

    /**
     * Get progress percentage (0-100)
     */
    getProgress() {
        if (this.duration === 0) return 0;
        return ((this.duration - this.remaining) / this.duration) * 100;
    }

    /**
     * Format time as MM:SS
     */
    formatTime(seconds = this.remaining) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Play beep sound using Web Audio API
     */
    playBeep() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.value = 880; // A5 note
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.5);

            // Play second beep after short delay
            setTimeout(() => {
                const osc2 = this.audioContext.createOscillator();
                const gain2 = this.audioContext.createGain();

                osc2.connect(gain2);
                gain2.connect(this.audioContext.destination);

                osc2.frequency.value = 1320; // E6 note (higher)
                osc2.type = 'sine';

                gain2.gain.setValueAtTime(0.5, this.audioContext.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

                osc2.start(this.audioContext.currentTime);
                osc2.stop(this.audioContext.currentTime + 0.5);
            }, 300);
        } catch (e) {
            console.warn('[Timer] Audio not available:', e);
        }
    }

    /**
     * Vibrate device if supported
     */
    vibrate() {
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 400]);
        }
    }

    /**
     * Create timer UI
     */
    createTimerUI(container, initialSeconds = 60) {
        this.duration = initialSeconds;
        this.remaining = initialSeconds;

        const html = `
      <div class="timer-display">
        <div class="timer-ring">
          <svg viewBox="0 0 100 100">
            <circle class="timer-ring-bg" cx="50" cy="50" r="45"></circle>
            <circle class="timer-ring-progress" cx="50" cy="50" r="45" 
              stroke-dasharray="283" stroke-dashoffset="0"></circle>
          </svg>
          <div class="timer-value" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
            ${this.formatTime(initialSeconds)}
          </div>
        </div>
        <div class="timer-label">Tempo de Descanso</div>
        <div class="timer-controls">
          <button class="btn btn-secondary timer-btn" data-action="subtract">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            15s
          </button>
          <button class="btn btn-primary btn-lg timer-btn" data-action="toggle" style="width: 80px; height: 80px; border-radius: 50%;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="play-icon">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="pause-icon hidden">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          </button>
          <button class="btn btn-secondary timer-btn" data-action="add">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            15s
          </button>
        </div>
        <div class="timer-presets" style="display: flex; gap: var(--spacing-sm); justify-content: center; margin-top: var(--spacing-lg);">
          <button class="btn btn-ghost timer-preset" data-seconds="30">30s</button>
          <button class="btn btn-ghost timer-preset" data-seconds="60">60s</button>
          <button class="btn btn-ghost timer-preset" data-seconds="90">90s</button>
          <button class="btn btn-ghost timer-preset" data-seconds="120">2min</button>
        </div>
      </div>
    `;

        container.innerHTML = html;

        // Get elements
        const timerValue = container.querySelector('.timer-value');
        const progressRing = container.querySelector('.timer-ring-progress');
        const toggleBtn = container.querySelector('[data-action="toggle"]');
        const playIcon = toggleBtn.querySelector('.play-icon');
        const pauseIcon = toggleBtn.querySelector('.pause-icon');
        const circumference = 2 * Math.PI * 45; // r=45
        progressRing.style.strokeDasharray = circumference;

        // Update UI function
        const updateUI = (remaining, progress) => {
            timerValue.textContent = this.formatTime(remaining);
            const offset = circumference - (progress / 100) * circumference;
            progressRing.style.strokeDashoffset = offset;
        };

        // Toggle button
        toggleBtn.addEventListener('click', () => {
            if (this.isRunning) {
                this.pause();
                playIcon.classList.remove('hidden');
                pauseIcon.classList.add('hidden');
            } else {
                this.start(this.remaining, {
                    onTick: updateUI,
                    onComplete: () => {
                        playIcon.classList.remove('hidden');
                        pauseIcon.classList.add('hidden');
                        window.toast?.success('Tempo de descanso finalizado!');
                    }
                });
                playIcon.classList.add('hidden');
                pauseIcon.classList.remove('hidden');
            }
        });

        // Add/subtract buttons
        container.querySelector('[data-action="add"]').addEventListener('click', () => {
            this.remaining += 15;
            this.duration = Math.max(this.duration, this.remaining);
            updateUI(this.remaining, this.getProgress());
        });

        container.querySelector('[data-action="subtract"]').addEventListener('click', () => {
            this.remaining = Math.max(0, this.remaining - 15);
            updateUI(this.remaining, this.getProgress());
        });

        // Preset buttons
        container.querySelectorAll('.timer-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const seconds = parseInt(btn.dataset.seconds);
                this.stop();
                this.duration = seconds;
                this.remaining = seconds;
                updateUI(this.remaining, 0);
                progressRing.style.strokeDashoffset = 0;
                playIcon.classList.remove('hidden');
                pauseIcon.classList.add('hidden');
            });
        });

        return this;
    }
}

// Export singleton
const timer = new Timer();
export { timer, Timer };
