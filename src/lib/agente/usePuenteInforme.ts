import { useEffect, useRef, type RefObject } from 'react'
import { filaResumenTexto } from '../reportes'
import { reemplazarTextoEnElemento, registrarInformeActivo } from './informeActivo'

interface Opciones {
  tipo: 'diario' | 'final'
  cuerpoRef: RefObject<HTMLDivElement>
  whatsapp: string
  setWhatsapp: (t: string) => void
  asunto: string
  setAsunto: (t: string) => void
  regenerar: () => Promise<void>
}

/** Expone al asistente el informe que está en pantalla (leer, ajustar, regenerar, deshacer). */
export function usePuenteInforme(o: Opciones): void {
  const ref = useRef(o)
  ref.current = o

  useEffect(() => {
    return registrarInformeActivo({
      tipo: o.tipo,
      textoCorreo: () => ref.current.cuerpoRef.current?.innerText ?? '',
      textoWhatsApp: () => ref.current.whatsapp,
      asunto: () => ref.current.asunto,
      reemplazarEnCorreo: (buscar, reemplazar) => {
        const el = ref.current.cuerpoRef.current
        return el ? reemplazarTextoEnElemento(el, buscar, reemplazar) : 0
      },
      agregarAlResumen: (texto) => {
        const tabla = ref.current.cuerpoRef.current?.querySelector('table[data-resumen]')
        if (!tabla || !texto.trim()) return false
        const cuerpo = tabla.querySelector('tbody') ?? tabla
        cuerpo.insertAdjacentHTML('beforeend', filaResumenTexto(texto.trim()))
        return true
      },
      fijarWhatsApp: (t) => ref.current.setWhatsapp(t),
      fijarAsunto: (t) => ref.current.setAsunto(t),
      regenerar: () => ref.current.regenerar(),
      instantanea: () => ({
        correoHtml: ref.current.cuerpoRef.current?.innerHTML ?? '',
        whatsapp: ref.current.whatsapp,
        asunto: ref.current.asunto,
      }),
      restaurar: (i) => {
        if (ref.current.cuerpoRef.current) ref.current.cuerpoRef.current.innerHTML = i.correoHtml
        ref.current.setWhatsapp(i.whatsapp)
        ref.current.setAsunto(i.asunto)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
