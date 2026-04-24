"use client"

import { useParams } from "next/navigation"

export default function ProfilePage() {
    const params = useParams()
    const username = params['username'];

    return <h1>Profile Page {username}</h1>
}
