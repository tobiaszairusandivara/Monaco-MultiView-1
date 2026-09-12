import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import monaco from '../monaco-setup';
import type { IntegrityEvent, IntegrityEventType } from './challenge-types';

const BASE_FONT_SIZE = 14;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 40;

@Component({
  selector: 'app-monaco-editor',
  imports: [],
  styleUrl: './monaco-editor.css',
  templateUrl: './monaco-editor.html',
})
export class MonacoEditor implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('host', { static: true }) private readonly host!: ElementRef<HTMLDivElement>;

  @Input() value = '';
  @Input() language = 'plaintext';
  @Input() theme = 'vs';

  @Output() readonly valueChange = new EventEmitter<string>();
  @Output() readonly zoomChange = new EventEmitter<number>();
  @Output() readonly integrityEvent = new EventEmitter<IntegrityEvent>();

  private editor?: monaco.editor.IStandaloneCodeEditor;
  private readonly disposables: monaco.IDisposable[] = [];

  private readonly onCopy = (): void => {
    this.emitIntegrityEvent('COPY', window.getSelection()?.toString() ?? '');
  };

  private readonly onPaste = (event: ClipboardEvent): void => {
    this.emitIntegrityEvent('PASTE', event.clipboardData?.getData('text/plain') ?? '');
  };

  private emitIntegrityEvent(type: IntegrityEventType, text: string): void {
    this.integrityEvent.emit({
      type,
      timestamp: new Date().toISOString(),
      characters: text.length,
      lines: text ? text.split('\n').length : 0,
    });
  }

  ngAfterViewInit() {
    this.editor = monaco.editor.create(this.host.nativeElement, {
      value: this.value,
      language: this.language,
      theme: this.theme,
      fontSize: BASE_FONT_SIZE,
      minimap: { enabled: false },
      automaticLayout: true,
      mouseWheelZoom: true,
    });

    this.host.nativeElement.addEventListener('copy', this.onCopy, true);
    this.host.nativeElement.addEventListener('paste', this.onPaste, true);

    this.disposables.push(
      this.editor.onDidChangeModelContent(() =>
        this.valueChange.emit(this.editor?.getValue() ?? ''),
      ),
      this.editor.onDidChangeConfiguration((event) => {
        if (event.hasChanged(monaco.editor.EditorOption.fontSize)) {
          const size = this.editor?.getOption(monaco.editor.EditorOption.fontSize);
          if (typeof size === 'number') {
            this.zoomChange.emit(size);
          }
        }
      }),
    );

    this.zoomChange.emit(BASE_FONT_SIZE);
  }

  zoomIn() {
    this.adjustFont(+2);
  }

  zoomOut() {
    this.adjustFont(-2);
  }

  resetZoom() {
    this.setFontSize(BASE_FONT_SIZE);
  }

  private adjustFont(delta: number) {
    const current = this.editor?.getOption(monaco.editor.EditorOption.fontSize) ?? BASE_FONT_SIZE;
    this.setFontSize(current + delta);
  }

  private setFontSize(next: number) {
    const size = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, next));
    this.editor?.updateOptions({ fontSize: size });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.editor) {
      return;
    }

    if (changes['value']?.currentValue !== this.editor.getValue()) {
      this.editor.setValue(changes['value'].currentValue ?? '');
    }

    if (changes['language']) {
      const model = this.editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, changes['language'].currentValue);
      }
    }

    if (changes['theme']) {
      monaco.editor.setTheme(changes['theme'].currentValue);
    }
  }

  ngOnDestroy() {
    this.disposables.forEach((disposable) => disposable.dispose());
    this.host.nativeElement.removeEventListener('copy', this.onCopy, true);
    this.host.nativeElement.removeEventListener('paste', this.onPaste, true);
    this.editor?.dispose();
  }
}