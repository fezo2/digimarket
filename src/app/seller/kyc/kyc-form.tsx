"use client";

import { useActionState, useState } from "react";
import { prepareUploads } from "@/lib/upload-form";
import { submitKyc, type FormState } from "../actions";

export function KycForm({
  defaultType,
}: {
  defaultType: "INDIVIDUAL" | "COMPANY";
}) {
  const [state, action, pending] = useActionState(
    async (state: FormState, form: FormData) => {
      try {
        await prepareUploads(form, "kyc", [
          "idFront",
          "idBack",
          "selfie",
          "commercialReg",
          "taxCard",
        ]);
      } catch {
        return { error: "رفع الملفات فشل، جرّب تاني" };
      }
      return submitKyc(state, form);
    },
    undefined,
  );
  const [type, setType] = useState(defaultType);

  return (
    <form action={action} className="mt-6 space-y-6">
      <section className="card space-y-4 p-6">
        <h2 className="font-bold">نوع الحساب</h2>
        <div className="flex gap-4 text-sm">
          {(["INDIVIDUAL", "COMPANY"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2">
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
              />
              {t === "INDIVIDUAL" ? "فرد" : "شركة"}
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-bold">
          البيانات الشخصية {type === "COMPANY" && "(المسؤول عن الشركة)"}
        </h2>
        <Field name="fullName" label="الاسم كامل زي البطاقة" />
        <Field
          name="nationalId"
          label="الرقم القومي (14 رقم)"
          dir="ltr"
          inputMode="numeric"
          maxLength={14}
        />
        <Field
          name="phone"
          label="رقم الموبايل"
          dir="ltr"
          inputMode="tel"
          placeholder="01xxxxxxxxx"
        />
        <FileField name="idFront" label="صورة البطاقة (وش)" />
        <FileField name="idBack" label="صورة البطاقة (ضهر)" />
        <FileField name="selfie" label="سيلفي وانت ماسك البطاقة" />
      </section>

      {type === "COMPANY" && (
        <section className="card space-y-4 p-6">
          <h2 className="font-bold">بيانات الشركة</h2>
          <Field name="companyName" label="اسم الشركة" />
          <Field name="commercialRegNo" label="رقم السجل التجاري" dir="ltr" />
          <Field name="taxCardNo" label="رقم البطاقة الضريبية" dir="ltr" />
          <FileField name="commercialReg" label="صورة السجل التجاري" />
          <FileField name="taxCard" label="صورة البطاقة الضريبية" />
        </section>
      )}

      <section className="card space-y-4 p-6">
        <h2 className="font-bold">استلام الأرباح</h2>
        <div>
          <label className="label" htmlFor="payoutMethod">
            الطريقة
          </label>
          <select id="payoutMethod" name="payoutMethod" className="input">
            <option value="INSTAPAY">InstaPay</option>
            <option value="MOBILE_WALLET">
              محفظة موبايل (فودافون كاش وغيرها)
            </option>
            <option value="BANK_TRANSFER">تحويل بنكي</option>
          </select>
        </div>
        <Field
          name="payoutAccount"
          label="العنوان أو الرقم (InstaPay / رقم المحفظة / IBAN)"
          dir="ltr"
        />
        <Field name="payoutAccountName" label="اسم صاحب الحساب" />
      </section>

      {state?.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "بنرفع المستندات…" : "إرسال للمراجعة"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  ...rest
}: {
  name: string;
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} required className="input" {...rest} />
    </div>
  );
}

function FileField({ name, label }: { name: string; label: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        required
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700"
      />
    </div>
  );
}
