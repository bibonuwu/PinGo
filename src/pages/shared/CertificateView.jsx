import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDoc } from 'firebase/firestore';
import { PrinterIcon } from '@phosphor-icons/react';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { useThemeColor } from '../../hooks/useThemeColor';
import { db } from '../../lib/db';
import { ref } from '../../lib/remote';
import { CERTIFICATE_MAP, SLOGAN } from '../../lib/constants';
import { fmtDateYear } from '../../lib/utils';
import { homePath, useAuth } from '../../context/AuthContext';
import { kindLabel } from '../../services/profiles';
import { certificateNumber } from '../../components/Certificate';
import { EmptyState } from '../../components/EmptyState';
import { BackButton } from '../../components/PageHeader';
import { Pingo } from '../../components/Pingo';
import { Button, ButtonLink } from '../../components/ui';

// Сертификат Pingo: открывается из уведомления, анкеты или админ-панели; «Печать» сохраняет его в PDF.
export default function CertificateView() {
  useThemeColor('#F2F2F7');
  const { id } = useParams();
  const { user } = useAuth();
  const local = useLiveQuery(async () => (await db.certificates.get(id)) ?? null, [id]);
  // Чужого сертификата может не быть в локальном зеркале — тогда читаем его напрямую.
  const [remote, setRemote] = useState();
  useEffect(() => {
    if (local !== null) return undefined;
    let active = true;
    getDoc(ref('certificates', id))
      .then((snap) => active && setRemote(snap.exists() ? snap.data() : null))
      .catch(() => active && setRemote(null));
    return () => {
      active = false;
    };
  }, [id, local]);

  const cert = local ?? remote;
  const home = homePath(user.role);
  if (cert === undefined) return <div className="page page--loading" />;
  if (!cert) {
    return (
      <div className="page">
        <BackButton to={home} />
        <EmptyState pingo title="Сертификат не найден" text="Возможно, его отозвали." action={<ButtonLink to={home}>На главную</ButtonLink>} />
      </div>
    );
  }

  const meta = CERTIFICATE_MAP[cert.type] ?? CERTIFICATE_MAP.custom;
  return (
    <div className="cert-page">
      <div className="cert-page__bar">
        <BackButton to={home} />
        <Button variant="dark" icon={PrinterIcon} onClick={() => window.print()}>
          Распечатать или сохранить PDF
        </Button>
      </div>
      <article className="cert" style={{ '--cert-accent': meta.color }}>
        <div className="cert__frame">
          <header className="cert__brand">
            <img src="/images/logo.png" alt="" width="40" height="40" />
            <span>
              <strong>Pingo</strong> · {SLOGAN}
            </span>
          </header>
          <p className="cert__eyebrow">Сертификат</p>
          <h1 className="cert__title">{cert.title}</h1>
          <p className="cert__given">вручается</p>
          <p className="cert__name">{cert.recipientName}</p>
          {cert.recipientKind && <p className="cert__kind">{kindLabel(cert.recipientKind)} Pingo</p>}
          {cert.text && <p className="cert__text">{cert.text}</p>}
          <footer className="cert__foot">
            <div>
              <span>Дата</span>
              <strong>{fmtDateYear(cert.issuedAt)}</strong>
            </div>
            <div className="cert__seal" aria-hidden="true">
              <Pingo size={68} mood="happy" animated={false} />
            </div>
            <div>
              <span>Номер</span>
              <strong>{certificateNumber(cert)}</strong>
            </div>
          </footer>
          <p className="cert__sign">Команда Pingo{cert.issuedByName ? ` · модератор ${cert.issuedByName}` : ''}</p>
        </div>
      </article>
    </div>
  );
}
