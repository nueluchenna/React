import { Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom'
import React from 'react'
import MainLayout from './layouts/MainLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import JobsPage from './pages/JobsPage.jsx'
import ErrorPage from './pages/ErrorPage.jsx'

const router = createBrowserRouter(
  createRoutesFromElements(
  <Route path='/' element={ <MainLayout />} >
    <Route path='/' element={ <HomePage />} />
    <Route path='jobs' element={ <JobsPage />} />
    <Route path='*' element={ <ErrorPage />} />
  </Route>
)
);

const App = () => {
  return <RouterProvider router={router} />;
}

export default App

