import { useFormik } from "formik";
import React from "react";

function SignIn() {
  const formik = useFormik({
    initialValues: {
      name: "",
      password: "",
    },
    onSubmit: (values) => {
      console.log({ values });
      alert(JSON.stringify(values));
    },
  });

  return (
    <form className="sign-form" onSubmit={formik.handleSubmit}>
      <input
        id="name"
        name="name"
        type="text"
        placeholder="id"
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        value={formik.values.name}
      />
      <input
        id="password"
        name="password"
        type="password"
        placeholder="password"
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        value={formik.values.password}
      />

      <button>로그인</button>
    </form>
  );
}

export default SignIn;
