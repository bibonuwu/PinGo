import { motion } from 'framer-motion';
import { CheckCircleIcon, DeviceMobileIcon, DownloadSimpleIcon, ExportIcon, PlusSquareIcon } from '@phosphor-icons/react';
import { promptInstall, useInstallState } from '../lib/install';
import { useToast } from '../context/ToastContext';
import { Button } from './ui';

// «Установить как приложение» (PWA): Chrome/Edge/Android — системный диалог, iOS — инструкция.
export function InstallCard({ compact = false }) {
  const { canPrompt, installed, ios } = useInstallState();
  const toast = useToast();

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') toast.success('Pingo установлен! Ищите иконку пингвина на экране.');
  };

  if (compact) {
    if (installed || !canPrompt) return null;
    return (
      <Button variant="soft" size="sm" icon={DownloadSimpleIcon} onClick={install} block>
        Установить приложение
      </Button>
    );
  }

  return (
    <motion.div className="install-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <img src="/icons/icon-192.png" alt="" className="install-card__icon" width="64" height="64" />
      <div className="install-card__body">
        <h3>Pingo как приложение</h3>
        {installed ? (
          <p className="install-card__ok">
            <CheckCircleIcon size={18} weight="fill" /> Приложение установлено на этом устройстве
          </p>
        ) : canPrompt ? (
          <>
            <p>Иконка на главном экране, запуск в отдельном окне и работа без интернета.</p>
            <Button icon={DownloadSimpleIcon} onClick={install}>
              Установить Pingo
            </Button>
          </>
        ) : ios ? (
          <ol className="install-card__steps">
            <li>
              Нажмите <ExportIcon size={18} weight="bold" /> «Поделиться» в Safari
            </li>
            <li>
              Выберите <PlusSquareIcon size={18} weight="bold" /> «На экран „Домой“»
            </li>
            <li>Нажмите «Добавить» — Pingo появится среди приложений</li>
          </ol>
        ) : (
          <>
            <p>
              <DeviceMobileIcon size={18} weight="bold" /> Откройте меню браузера и выберите «Установить приложение» или
              «Добавить на главный экран».
            </p>
            <p className="install-card__note">
              Кнопка установки появляется в Chrome, Edge и Яндекс Браузере, когда сайт открыт по https (или на localhost в
              production-сборке).
            </p>
          </>
        )}
      </div>
    </motion.div>
  );
}
