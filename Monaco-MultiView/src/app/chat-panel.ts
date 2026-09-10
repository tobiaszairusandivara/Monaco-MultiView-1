import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { CompileService } from './compile.service';
import type { ChatMessage, RiskLevel } from './challenge-types';

@Component({
  selector: 'app-chat-panel',
  imports: [],
  templateUrl: './chat-panel.html',
  styleUrl: './chat-panel.css',
})
export class ChatPanel implements OnChanges {
  @Input() challengeId: string | null = null;
  @Input() riskLevel: RiskLevel = 'MEDIO';
  @Input() allowReset = true;

  @Output() readonly transcriptChange = new EventEmitter<ChatMessage[]>();

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly busy = signal(false);
  protected readonly provider = signal('stub');
  protected readonly model = signal('');
  protected readonly open = signal(false);
  protected draft = '';

  constructor(private readonly compileService: CompileService) {}

  ngOnChanges(): void {
    if (this.messages().length === 0) {
      this.messages.set([this.greetingFor(this.riskLevel)]);
      this.emitTranscript();
    }
    void this.providerLabel();
  }

  protected readonly quickActions = computed(() => {
    switch (this.riskLevel) {
      case 'ALTO':
        return ['¿Qué debería lograr este bloque?', 'Ayúdame con la estrategia', '¿Cómo puedo probar mi código?'];
      case 'BAJO':
        return ['Revisemos mi criterio', '¿Qué tengo que justificar?'];
      default:
        return ['Necesito un enfoque conceptual', '¿Qué documentación me conviene?'];
    }
  });

  protected toggle(): void {
    this.open.update((value) => !value);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onDraftInput(event: Event): void {
    this.draft = (event.target as HTMLInputElement).value;
  }

  protected async send(action?: string): Promise<void> {
    const text = (action ?? this.draft).trim();
    if (!text || this.busy()) {
      return;
    }
    this.messages.update((list) => [...list, { role: 'user', text }]);
    this.draft = '';
    this.busy.set(true);
    try {
      const result = await this.compileService.askChat({
        challengeId: this.challengeId,
        riskLevel: this.riskLevel,
        messages: this.messages(),
      });
      this.messages.update((list) => [...list, { role: 'assistant', text: result.reply }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.messages.update((list) => [
        ...list,
        { role: 'assistant', text: `(error temporal) ${message}` },
      ]);
    } finally {
      this.busy.set(false);
      this.emitTranscript();
    }
  }

  protected reset(): void {
    this.messages.set([this.greetingFor(this.riskLevel)]);
    this.draft = '';
    this.busy.set(false);
    this.emitTranscript();
  }

  private async providerLabel(): Promise<void> {
    try {
      const status = await this.compileService.getChatStatus();
      this.provider.set(status.chat.provider);
      this.model.set(status.chat.model);
    } catch {
      /* keep stub default */
    }
  }

  private greetingFor(riskLevel: RiskLevel): ChatMessage {
    const text =
      riskLevel === 'ALTO'
        ? 'Hola. Soy el tutor de este desafío (riesgo ALTO). No puedo escribirle la solución ni el bloque que falta, pero sí guiarlo con preguntas y estrategia. ¿En qué parte se trabó?'
        : riskLevel === 'BAJO'
          ? 'Hola. Soy el tutor de este desafío (riesgo BAJO): aquí lo importante es el proceso y el criterio. Cuénteme qué resolvió y revisamos su razonamiento.'
          : 'Hola. Soy el tutor de este desafío (riesgo MEDIO). Puedo ayudarlo con enfoques conceptuales, documentación y buenas prácticas. ¿Por dónde empezamos?';
    return { role: 'assistant', text };
  }

  private emitTranscript(): void {
    this.transcriptChange.emit(this.messages());
  }
}